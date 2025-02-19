/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import type { TransformPutTransformRequest } from '@elastic/elasticsearch/lib/api/types';
import { FINDINGS_INDEX_PATTERN, LATEST_FINDINGS_INDEX_DEFAULT_NS } from '../../common/constants';

export const latestFindingsTransform: TransformPutTransformRequest = {
  transform_id: 'cloud_security_posture.findings_latest-default-0.0.1',
  description: 'Defines findings transformation to view only the latest finding per resource',
  source: {
    index: FINDINGS_INDEX_PATTERN,
  },
  dest: {
    index: LATEST_FINDINGS_INDEX_DEFAULT_NS,
  },
  frequency: '5m',
  sync: {
    time: {
      field: 'event.ingested',
      delay: '60s',
    },
  },
  retention_policy: {
    time: {
      field: '@timestamp',
      max_age: '5h',
    },
  },
  latest: {
    sort: '@timestamp',
    unique_key: ['resource.id.keyword', 'rule.id'],
  },
  _meta: {
    managed: 'true',
  },
};
