declare module "node-osascript" {
  interface ChildProcess {
    stdin?: any;
    kill(): void;
  }

  export function execute(
    script: string,
    variables?: Record<string, any>,
    callback?: (err: any, result: any, raw?: any) => void
  ): ChildProcess;
}
