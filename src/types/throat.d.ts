declare module "throat" {
  function throat<
    TResult,
    TFn extends (...args: Array<any>) => Promise<TResult>
  >(size: number, fn: TFn): TFn;
  function throat<
    TResult,
    TFn extends (...args: Array<any>) => Promise<TResult>
  >(fn: TFn, size: number): TFn;
  function throat(
    size: number
  ): <TResult>(fn: () => Promise<TResult>) => Promise<TResult>;

  export = throat;
}
