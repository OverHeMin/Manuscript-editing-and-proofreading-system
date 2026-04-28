create index if not exists knowledge_hit_logs_item_created_at_idx
  on knowledge_hit_logs (knowledge_item_id, created_at, id);
