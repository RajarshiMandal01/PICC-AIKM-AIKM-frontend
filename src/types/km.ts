export type BucketStatus = 'PROVISIONING' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED' | 'FAILED' | 'DELETED';
export type DocStatus = 'PENDING' | 'INGESTED' | 'FAILED' | 'DELETED';

export interface Bucket {
  id: string;
  bucket_name: string;
  bucket_category: string | null;
  bucket_desc: string | null;
  bucket_spec: string | null;
  bucket_url: string | null;
  status: BucketStatus;
  error_detail: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface BucketDetail {
  id: string;
  bucket_id: string;
  doc_category: string | null;
  doc_name: string | null;
  description: string | null;
  format: string | null;
  doc_size: number | null;
  status: DocStatus;
  milvus_source_id: string | null;
  milvus_chunks_stored: number;
  ingested_at: string | null;
  error_detail: string | null;
}

// ---------------------------------------------------------------------------
// Data SQL types
// ---------------------------------------------------------------------------

export type DbStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED' | 'DELETED';

export type QueryStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | 'DELETED';

export interface KmSqlQuery {
  id: string;
  database_id: string;
  query_name: string | null;
  query_desc: string | null;
  query_context: string | null;
  query_text: string | null;
  rank: number | null;
  quality_score: number | null;
  status: QueryStatus;
  times_used: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface KmDdl {
  id: string;
  database_id: string;
  table_name: string | null;
  ddl_text: string;
  vanna_vector_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface KmRule {
  id: string;
  database_id: string;
  rule_name: string | null;
  rule_text: string;
  vanna_vector_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface KmDatabase {
  id: string;
  bucket_id: string;
  database_name: string | null;
  database_type: string | null;
  database_desc: string | null;
  connection_url: string | null;
  training_script: string | null;
  keywords: string[] | null;
  status: DbStatus;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  queries: KmSqlQuery[];
  ddl: KmDdl[];
  rules: KmRule[];
}

export interface SqlQueryResponse {
  query: string;
  answer: string;
  processing_time: number;
  timestamp: string;
  sql_query: string | null;
  sql_data: {
    columns: string[];
    rows: any[][];
    row_count: number;
  } | null;
  chart: any | null;
  query_type: string;
  metadata: Record<string, any>;
}
