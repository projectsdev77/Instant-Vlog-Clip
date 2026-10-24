/** Drops the console errors the stand-in AI causes on purpose (it fails clip
 * analysis so the on-device fallback runs), leaving only real problems. */
export const unexpected = (errors) => errors.filter((e) => !/status of 502|Clip analysis failed; using on-device signals/.test(e))
