\if :{?migrator_user}
\else
\quit 'migrator_user is required'
\endif
\if :{?migrator_password}
\else
\quit 'migrator_password is required'
\endif
\if :{?app_user}
\else
\quit 'app_user is required'
\endif
\if :{?app_password}
\else
\quit 'app_password is required'
\endif

SELECT format('CREATE ROLE %I LOGIN', :'migrator_user')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'migrator_user') \gexec
SELECT format('ALTER ROLE %I PASSWORD %L', :'migrator_user', :'migrator_password') \gexec

SELECT format('CREATE ROLE %I LOGIN', :'app_user')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'app_user') \gexec
SELECT format('ALTER ROLE %I PASSWORD %L', :'app_user', :'app_password') \gexec

SELECT format('ALTER DATABASE %I OWNER TO %I', current_database(), :'migrator_user') \gexec
SELECT format('ALTER SCHEMA public OWNER TO %I', :'migrator_user') \gexec
SELECT format('ALTER TABLE %I.%I OWNER TO %I', schemaname, tablename, :'migrator_user')
FROM pg_tables
WHERE schemaname = 'public' \gexec
SELECT format('ALTER SEQUENCE %I.%I OWNER TO %I', schemaname, sequencename, :'migrator_user')
FROM pg_sequences
WHERE schemaname = 'public' \gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), :'app_user') \gexec
SELECT format('GRANT USAGE ON SCHEMA public TO %I', :'app_user') \gexec
SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO %I', :'app_user') \gexec
SELECT format('GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO %I', :'app_user') \gexec
SELECT format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I', :'migrator_user', :'app_user') \gexec
SELECT format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO %I', :'migrator_user', :'app_user') \gexec
