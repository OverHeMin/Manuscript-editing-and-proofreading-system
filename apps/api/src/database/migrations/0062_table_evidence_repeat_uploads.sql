drop index if exists table_evidence_source_files_sha256_file_name_key;

create index if not exists table_evidence_source_files_sha256_file_name_idx
  on table_evidence_source_files (sha256 asc, file_name asc);
