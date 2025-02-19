/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { CoreSetup, CoreStart, Plugin } from '@kbn/core/public';
import { ExpressionsServerStart, ExpressionsServerSetup } from '@kbn/expressions-plugin/server';
import { metricVisFunction } from '../common';

interface SetupDeps {
  expressions: ExpressionsServerSetup;
}

interface StartDeps {
  expression: ExpressionsServerStart;
}

export type ExpressionLegacyMetricPluginSetup = void;
export type ExpressionLegacyMetricPluginStart = void;

export class ExpressionLegacyMetricPlugin
  implements
    Plugin<
      ExpressionLegacyMetricPluginSetup,
      ExpressionLegacyMetricPluginStart,
      SetupDeps,
      StartDeps
    >
{
  public setup(core: CoreSetup, { expressions }: SetupDeps): ExpressionLegacyMetricPluginSetup {
    expressions.registerFunction(metricVisFunction);
  }

  public start(core: CoreStart): ExpressionLegacyMetricPluginStart {}

  public stop() {}
}
