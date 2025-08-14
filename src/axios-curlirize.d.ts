declare module 'axios-curlirize' {
  import { AxiosInstance } from 'axios';
  
  interface CurlResult {
    command: string;
    object: any;
  }
  
  type CurlCallback = (result: CurlResult | null, error: Error | null) => void;
  
  function curlirize(instance: AxiosInstance, callback?: CurlCallback): void;
  
  export default curlirize;
}