-- Align the role hierarchy with the approved business roles and add
-- per-user permission override arrays for long-term access control.

ALTER TYPE "Role" RENAME TO "Role_old";

CREATE TYPE "Role" AS ENUM (
    'MD',
    'CFO',
    'BUSINESS_HEAD',
    'ACCOUNTS',
    'BD_TEAM',
    'BUSINESS_MANAGER',
    'SALES_TEAM',
    'FIELD_ENGINEER'
);

ALTER TABLE "User"
    ADD COLUMN "permissionGrants" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "permissionRevokes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "roles_new" "Role"[] NOT NULL DEFAULT ARRAY[]::"Role"[];

ALTER TABLE "User"
    ALTER COLUMN "role" TYPE "Role"
    USING (
      CASE "role"::text
        WHEN 'BUSINESS_MANAGER_STEEL' THEN 'BUSINESS_MANAGER'
        WHEN 'BUSINESS_MANAGER_TATA_GOVT' THEN 'BUSINESS_MANAGER'
        WHEN 'PROJECT_MANAGER' THEN 'BUSINESS_MANAGER'
        WHEN 'ADMIN_COORDINATOR' THEN 'BUSINESS_HEAD'
        ELSE "role"::text
      END
    )::"Role";

UPDATE "User"
SET "roles_new" = CASE
    WHEN "roles" IS NULL OR COALESCE(array_length("roles", 1), 0) = 0 THEN ARRAY["role"]
    ELSE ARRAY(
        SELECT DISTINCT mapped_role::"Role"
        FROM (
            SELECT CASE role_item
                WHEN 'BUSINESS_MANAGER_STEEL' THEN 'BUSINESS_MANAGER'
                WHEN 'BUSINESS_MANAGER_TATA_GOVT' THEN 'BUSINESS_MANAGER'
                WHEN 'PROJECT_MANAGER' THEN 'BUSINESS_MANAGER'
                WHEN 'ADMIN_COORDINATOR' THEN 'BUSINESS_HEAD'
                ELSE role_item
            END AS mapped_role
            FROM unnest("roles"::text[]) AS role_item
        ) AS mapped_roles
    )
END;

ALTER TABLE "User"
    DROP COLUMN "roles";

ALTER TABLE "User"
    RENAME COLUMN "roles_new" TO "roles";

UPDATE "User"
SET "roles" = ARRAY["role"]
WHERE COALESCE(array_length("roles", 1), 0) = 0;

ALTER TABLE "User"
    ALTER COLUMN "roles" SET DEFAULT ARRAY[]::"Role"[];

DROP TYPE "Role_old";
