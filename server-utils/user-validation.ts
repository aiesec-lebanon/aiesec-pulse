"use server";

import fetchUserInfo from "./user-fetcher";
import UserInfo from "@/types/user-types";

interface ValidationResponse {
  isValid: boolean;
  user?: UserInfo;
}

/**
 * Allowed AIESEC Office IDs
 *
 * Example:
 * 1626 → AIESEC International
 *
 * If empty, users from ANY office will be allowed.
 *
 */
const ALLOWED_AIESEC_OFFICE_IDS: string[] = [];

/**
 * Allowed Roles
 *
 * Example roles:
 * - MCP
 * - MCVP
 * - LCP
 * - LCVP
 *
 * If empty, users with ANY role will be allowed.
 */
const ALLOWED_ROLES: string[] = [];

export default async function validateUser(
  accessToken: string,
): Promise<ValidationResponse> {
  try {
    const userInfo = await fetchUserInfo(accessToken);

    const hasOfficeRestriction = ALLOWED_AIESEC_OFFICE_IDS.length > 0;
    const hasRoleRestriction = ALLOWED_ROLES.length > 0;

    const isValid = userInfo.current_positions.some((position) => {
      const officeAllowed =
        !hasOfficeRestriction ||
        ALLOWED_AIESEC_OFFICE_IDS.includes(position.office.id);

      const roleAllowed =
        !hasRoleRestriction || ALLOWED_ROLES.includes(position.role.name);

      return officeAllowed && roleAllowed;
    });

    return { isValid, user: userInfo };
  } catch (error) {
    return { isValid: false };
  }
}
