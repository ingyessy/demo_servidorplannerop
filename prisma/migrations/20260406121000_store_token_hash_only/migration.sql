-- Rename plaintext token column to tokenHash to store only SHA-256 hashes
ALTER TABLE "Token" RENAME COLUMN "token" TO "tokenHash";

-- Keep index naming aligned with Prisma conventions
ALTER INDEX "Token_token_key" RENAME TO "Token_tokenHash_key";
