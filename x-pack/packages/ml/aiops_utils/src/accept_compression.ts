/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

/**
 * TODO: Replace these with kbn packaged versions once we have those available to us.
 * At the moment imports from runtime plugins into packages are not supported.
 * import type { Headers } from '@kbn/core/server';
 */
type Headers = Record<string, string | string[] | undefined>;

function containsGzip(s: string) {
  return s
    .split(',')
    .map((d) => d.trim())
    .includes('gzip');
}

/**
 * Returns whether request headers accept a response using gzip compression.
 *
 * @param headers - Request headers.
 * @returns boolean
 */
export function acceptCompression(headers: Headers) {
  let compressed = false;

  Object.keys(headers).forEach((key) => {
    if (key.toLocaleLowerCase() === 'accept-encoding') {
      const acceptEncoding = headers[key];

      if (typeof acceptEncoding === 'string') {
        compressed = containsGzip(acceptEncoding);
      } else if (Array.isArray(acceptEncoding)) {
        for (const ae of acceptEncoding) {
          if (containsGzip(ae)) {
            compressed = true;
            break;
          }
        }
      }
    }
  });

  return compressed;
}
