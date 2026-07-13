UPDATE "User"
SET
  email = LOWER(TRIM(email)),
  username = LOWER(TRIM(email));

UPDATE "Account"
SET "accountNo" = LOWER(TRIM("accountNo"));

ALTER TABLE "User"
ALTER COLUMN email SET NOT NULL;

CREATE UNIQUE INDEX "User_email_ci_key"
ON "User" (LOWER(email));

CREATE UNIQUE INDEX "Account_accountNo_ci_key"
ON "Account" (LOWER("accountNo"));
