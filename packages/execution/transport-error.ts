// Only trusted checks before WebSocket.send may use this. Any error thrown by
// the transport itself remains ambiguous and must be reconciled without retry.
export class NotSentError extends Error {
  constructor(message:string){super(message);this.name='NotSentError';}
}
