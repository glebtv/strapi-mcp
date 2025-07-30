import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";
import axios from "axios";
import { ExtendedMcpError, ExtendedErrorCode } from "../errors/index.js";

export interface RegisterUserParams {
  email: string;
  password: string;
  firstname?: string;
  lastname?: string;
}

export async function registerFirstAdmin(params: RegisterUserParams): Promise<{
  user: {
    id: number;
    email: string;
    firstname?: string;
    lastname?: string;
  };
  jwt: string;
}> {
  const { email, password, firstname = "Admin", lastname = "User" } = params;

  try {
    logger.info(`[API] Registering first admin user: ${email}`);

    // Check if this is truly the first user by checking if any admins exist
    try {
      const checkResponse = await axios.get(
        `${config.strapi.url}/admin/users?filters[isActive][$eq]=true`,
        {
          validateStatus: () => true,
          timeout: 5000,
        }
      );

      // If we get a successful response, it means there are already users
      if (checkResponse.status === 200) {
        throw new ExtendedMcpError(
          ExtendedErrorCode.InvalidRequest,
          "Admin users already exist. This tool can only be used for initial setup."
        );
      }
    } catch (error: any) {
      // If we get 401/403, it's expected - no users exist yet
      if (error.response?.status !== 401 && error.response?.status !== 403 && !error.code) {
        throw error;
      }
    }

    // Register the first admin
    const response = await axios.post(
      `${config.strapi.url}/admin/register-admin`,
      {
        email,
        password,
        firstname,
        lastname,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );

    if (response.status !== 200) {
      throw new ExtendedMcpError(
        ExtendedErrorCode.InternalError,
        `Failed to register admin: ${response.status} ${response.statusText}`
      );
    }

    const { data } = response.data;

    logger.info(`[API] Successfully registered first admin user: ${email}`);

    return {
      user: {
        id: data.user.id,
        email: data.user.email,
        firstname: data.user.firstname,
        lastname: data.user.lastname,
      },
      jwt: data.jwt,
    };
  } catch (error: any) {
    if (error instanceof ExtendedMcpError) {
      throw error;
    }

    // Handle specific Strapi errors
    if (error.response?.status === 400) {
      const message = error.response.data?.error?.message || "Bad request";
      if (message.includes("already taken") || message.includes("already exists")) {
        throw new ExtendedMcpError(
          ExtendedErrorCode.InvalidRequest,
          "An admin with this email already exists"
        );
      }
      throw new ExtendedMcpError(
        ExtendedErrorCode.InvalidParams,
        `Invalid registration data: ${message}`
      );
    }

    if (error.response?.status === 423) {
      throw new ExtendedMcpError(
        ExtendedErrorCode.InvalidRequest,
        "Admin registration is locked. An admin user already exists."
      );
    }

    logger.error("[API] Failed to register admin:", error);
    throw new ExtendedMcpError(
      ExtendedErrorCode.InternalError,
      `Failed to register admin: ${error.message}`
    );
  }
}
