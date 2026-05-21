"use server";

import UserInfo from "@/types/user-types";
import axios from "axios";

const USER_QUERY = `
{
  currentPerson {
    full_name
    profile_photo
    current_positions {
      id
      office {
        id
        name
        tag
      }
      role {
        id
        name
      }
    }
  }
}
`;

export default async function fetchUserInfo(
  accessToken: string,
): Promise<UserInfo> {
  if (!process.env.NEXT_PUBLIC_AIESEC_GRAPHQL_API) {
    throw new Error("AIESEC GraphQL API URL is not configured");
  }

  const response = await axios.post(
    process.env.NEXT_PUBLIC_AIESEC_GRAPHQL_API,
    {
      query: USER_QUERY,
    },
    {
      headers: {
        Authorization: accessToken,
      },
    },
  );

  return response.data.data.currentPerson as UserInfo;
}
