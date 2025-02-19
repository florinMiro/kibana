/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { TIMESTAMP } from '@kbn/rule-data-utils';

import { get } from 'lodash/fp';
import set from 'set-value';
import type { Logger } from '@kbn/core/server';
import type {
  AlertInstanceContext,
  AlertInstanceState,
  RuleExecutorServices,
} from '@kbn/alerting-plugin/server';
import type { ThresholdNormalized } from '../../../../../common/detection_engine/schemas/common/schemas';
import type { BaseHit } from '../../../../../common/detection_engine/types';
import type { TermAggregationBucket } from '../../../types';
import type { GenericBulkCreateResponse } from '../../rule_types/factories/bulk_create_factory';
import { calculateThresholdSignalUuid, getThresholdAggregationParts } from '../utils';
import { buildReasonMessageForThresholdAlert } from '../reason_formatters';
import type {
  MultiAggBucket,
  SignalSource,
  SignalSearchResponse,
  ThresholdSignalHistory,
  BulkCreate,
  WrapHits,
} from '../types';
import type { CompleteRule, ThresholdRuleParams } from '../../schemas/rule_schemas';
import type { BaseFieldsLatest } from '../../../../../common/detection_engine/schemas/alerts';

interface BulkCreateThresholdSignalsParams {
  someResult: SignalSearchResponse;
  completeRule: CompleteRule<ThresholdRuleParams>;
  services: RuleExecutorServices<AlertInstanceState, AlertInstanceContext, 'default'>;
  inputIndexPattern: string[];
  logger: Logger;
  filter: unknown;
  signalsIndex: string;
  startedAt: Date;
  from: Date;
  signalHistory: ThresholdSignalHistory;
  bulkCreate: BulkCreate;
  wrapHits: WrapHits;
}

const getTransformedHits = (
  results: SignalSearchResponse,
  inputIndex: string,
  startedAt: Date,
  from: Date,
  threshold: ThresholdNormalized,
  ruleId: string
) => {
  if (results.aggregations == null) {
    return [];
  }
  const aggParts = threshold.field.length
    ? getThresholdAggregationParts(results.aggregations)
    : {
        field: null,
        index: 0,
        name: 'threshold_0',
      };

  if (!aggParts) {
    return [];
  }

  const getCombinations = (buckets: TermAggregationBucket[], i: number, field: string | null) => {
    return buckets.reduce((acc: MultiAggBucket[], bucket: TermAggregationBucket) => {
      if (i < threshold.field.length - 1) {
        const nextLevelIdx = i + 1;
        const nextLevelAggParts = getThresholdAggregationParts(bucket, nextLevelIdx);
        if (nextLevelAggParts == null) {
          throw new Error('Unable to parse aggregation.');
        }
        const nextLevelPath = `['${nextLevelAggParts.name}']['buckets']`;
        const nextBuckets = get(nextLevelPath, bucket);
        const combinations = getCombinations(nextBuckets, nextLevelIdx, nextLevelAggParts.field);
        combinations.forEach((val) => {
          const el = {
            terms: [
              {
                field,
                value: bucket.key,
              },
              ...val.terms,
            ].filter((term) => term.field != null),
            cardinality: val.cardinality,
            maxTimestamp: val.maxTimestamp,
            minTimestamp: val.minTimestamp,
            docCount: val.docCount,
          };
          acc.push(el as MultiAggBucket);
        });
      } else {
        const el = {
          terms: [
            {
              field,
              value: bucket.key,
            },
          ].filter((term) => term.field != null),
          cardinality: threshold.cardinality?.length
            ? [
                {
                  field: threshold.cardinality[0].field,
                  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                  value: bucket.cardinality_count!.value,
                },
              ]
            : undefined,
          maxTimestamp: bucket.max_timestamp.value_as_string,
          minTimestamp: bucket.min_timestamp.value_as_string,
          docCount: bucket.doc_count,
        };
        acc.push(el as MultiAggBucket);
      }

      return acc;
    }, []);
  };

  return getCombinations(
    (results.aggregations[aggParts.name] as { buckets: TermAggregationBucket[] }).buckets,
    0,
    aggParts.field
  ).reduce((acc: Array<BaseHit<SignalSource>>, bucket) => {
    const source = {
      [TIMESTAMP]: bucket.maxTimestamp,
      ...bucket.terms.reduce<object>((termAcc, term) => {
        if (!term.field.startsWith('signal.') && !term.field.startsWith('kibana.alert.')) {
          // We don't want to overwrite `signal.*` fields.
          // See: https://github.com/elastic/kibana/issues/83218
          return {
            ...termAcc,
            [term.field]: term.value,
          };
        }
        return termAcc;
      }, {}),
      threshold_result: {
        terms: bucket.terms,
        cardinality: bucket.cardinality,
        count: bucket.docCount,
        // Store `from` in the signal so that we know the lower bound for the
        // threshold set in the timeline search. The upper bound will always be
        // the `original_time` of the signal (the timestamp of the latest event
        // in the set).
        from: new Date(bucket.minTimestamp) ?? from,
      },
    };

    acc.push({
      _index: inputIndex,
      _id: calculateThresholdSignalUuid(
        ruleId,
        startedAt,
        threshold.field,
        bucket.terms
          .map((term) => term.value)
          .sort()
          .join(',')
      ),
      _source: source,
    });

    return acc;
  }, []);
};

export const transformThresholdResultsToEcs = (
  results: SignalSearchResponse,
  inputIndex: string,
  startedAt: Date,
  from: Date,
  threshold: ThresholdNormalized,
  ruleId: string
): SignalSearchResponse => {
  const transformedHits = getTransformedHits(
    results,
    inputIndex,
    startedAt,
    from,
    threshold,
    ruleId
  );
  const thresholdResults = {
    ...results,
    hits: {
      ...results.hits,
      hits: transformedHits,
    },
  };

  delete thresholdResults.aggregations; // delete because no longer needed

  set(thresholdResults, 'results.hits.total', transformedHits.length);

  return thresholdResults;
};

export const bulkCreateThresholdSignals = async (
  params: BulkCreateThresholdSignalsParams
): Promise<GenericBulkCreateResponse<BaseFieldsLatest>> => {
  const ruleParams = params.completeRule.ruleParams;
  const thresholdResults = params.someResult;
  const ecsResults = transformThresholdResultsToEcs(
    thresholdResults,
    params.inputIndexPattern.join(','),
    params.startedAt,
    params.from,
    ruleParams.threshold,
    ruleParams.ruleId
  );

  return params.bulkCreate(
    params.wrapHits(ecsResults.hits.hits, buildReasonMessageForThresholdAlert)
  );
};
