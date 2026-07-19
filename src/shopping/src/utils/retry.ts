interface jitterI {
  max: number;
  min: number;
}
type JitterT = number | [number, number];
class Retry {
  private _func;
  private _err_func;
  private _tries;
  private _delay;
  private max_delay;
  private backoff;
  private jitter;
  private retryStatusCodes;
  private retryErrors;

  constructor(
    func: (...args: any[]) => Promise<any>,
    err_func?: (error: unknown) => boolean,
    tries = Infinity,
    delay = 0,
    max_delay: any = null,
    backoff = 1,
    jitter: JitterT = 0,
    retryStatusCodes: number[] = [],
    retryErrors: string[] = [],
  ) {
    this._func = func;
    this._err_func = err_func;
    this._tries = tries;
    this._delay = delay;
    this.max_delay = max_delay;
    this.backoff = backoff;
    this.jitter = jitter;
    this.retryStatusCodes = retryStatusCodes;
    this.retryErrors = retryErrors;
  }

  async invoke(...args: any[]) {
    const self = this;
    return await self._callFunction(...args);
  }

  async _callFunction(...args: any[]) {
    const self = this;

    while (this._tries) {
      try {
        const result = await self._func(...args);
        return result;
      } catch (error) {
        this._tries -= 1;

        if (
          this.retryErrors.length !== 0 ||
          this.retryStatusCodes.length !== 0
        ) {
          if (!this.should_retry(error)) {
            throw error;
          }
        }
        if (this._err_func !== undefined && !this._err_func(error)) {
          throw error;
        }
        if (!this._tries) {
          throw error;
        }

        await new Promise((resolve) => setTimeout(resolve, this._delay * 1000));

        this._delay *= this.backoff;

        if (Array.isArray(this.jitter)) {
          const [a, b] = this.jitter;
          const min = Math.min(a, b);
          const max = Math.max(a, b);
          this._delay += Math.random() * (max - min) + min;
        } else {
          this._delay += this.jitter;
        }

        if (this.max_delay) {
          this._delay = Math.min(this._delay, this.max_delay);
        }

        
      }
    }
  }

  should_retry(err: any) {
    if (this.retryStatusCodes.includes(err.response?.status)) {
      return true;
    }

    if (this.retryErrors.includes(err.code)) {
      return true;
    }

    return false;
  }
}

export const retry_function = async (
  func: (...args: any[]) => Promise<any>,
  err_func?: (error: unknown) => boolean,
  tries = Infinity,
  delay = 0,
  max_delay: any = null,
  backoff = 1,
  jitter: JitterT = 0,
  retryStatusCodes: number[] = [],
  retryErrors: string[] = [],
) => {
  const retry = new Retry(
    func,
    err_func,
    tries,
    delay,
    max_delay,
    backoff,
    jitter,
    retryStatusCodes,
    retryErrors
  );

  const result = async (...args: any[]) => {
    return await retry.invoke(...args);
  };

  return result;
};
