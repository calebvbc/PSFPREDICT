DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum enum_value
    INNER JOIN pg_type enum_type ON enum_type.oid = enum_value.enumtypid
    INNER JOIN pg_namespace enum_namespace ON enum_namespace.oid = enum_type.typnamespace
    WHERE enum_namespace.nspname = 'public'
      AND enum_type.typname = 'match_round'
      AND enum_value.enumlabel = 'round_of_32'
  ) THEN
    ALTER TYPE "public"."match_round" ADD VALUE 'round_of_32' BEFORE 'round_of_16';
  END IF;
END $$;
