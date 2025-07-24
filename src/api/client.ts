import axios, { AxiosInstance } from "axios";
import qs from "qs";
import { config } from "../config/index.js";
import { ExtendedMcpError, ExtendedErrorCode } from "../errors/index.js";

export const strapiClient: AxiosInstance = axios.create({
  baseURL: config.strapi.url,
  headers: {
    "Content-Type": "application/json",
  },
  validateStatus: function (status) {
    return status < 500;
  },
  paramsSerializer: {
    serialize: (params) => {
      return qs.stringify(params, {
        encodeValuesOnly: true,
        arrayFormat: "brackets",
      });
    },
  },
});

if (config.strapi.apiToken) {
  strapiClient.defaults.headers.common["Authorization"] = `Bearer ${config.strapi.apiToken}`;
}

let connectionValidated = false;

export async function validateStrapiConnection(): Promise<void> {
  if (connectionValidated) return;

  try {
    let response;

    try {
      response = await strapiClient.get("/api/upload/files?pagination[limit]=1");
    } catch (apiError) {
      response = await strapiClient.get("/");
    }

    if (response && response.status >= 200 && response.status < 300) {
      connectionValidated = true;
    } else if (response) {
      throw new Error(`Unexpected response status: ${response.status}`);
    } else {
      throw new Error(`No response received from Strapi server`);
    }
  } catch (error: any) {
    let errorMessage = "Cannot connect to Strapi instance";

    if (axios.isAxiosError(error)) {
      if (error.code === "ECONNREFUSED") {
        errorMessage += `: Connection refused. Is Strapi running at ${config.strapi.url}?`;
      } else if (error.response?.status === 401) {
        errorMessage += `: Authentication failed. Check your API token or admin credentials.`;
      } else if (error.response?.status === 403) {
        errorMessage += `: Access forbidden. Your API token may lack necessary permissions.`;
      } else if (error.response?.status === 404) {
        errorMessage += `: Endpoint not found. Strapi server might be running but not properly configured.`;
      } else {
        errorMessage += `: ${error.message}`;
      }
    } else {
      errorMessage += `: ${error.message}`;
    }

    throw new ExtendedMcpError(ExtendedErrorCode.InternalError, errorMessage);
  }
}
