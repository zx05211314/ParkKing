export const extractRoutingUpstreamMessage = (
  status: number | undefined,
  payload: unknown,
) => {
  if (
    payload &&
    typeof payload === 'object' &&
    'message' in payload &&
    typeof payload.message === 'string'
  ) {
    return payload.message
  }
  return `Upstream router failed with ${status}.`
}
