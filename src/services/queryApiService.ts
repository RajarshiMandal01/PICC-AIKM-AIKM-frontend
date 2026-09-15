import { kmApi } from './kmApiService'

interface RAGResult {
  score: number
  text: string | null
}

export interface RagImage {
  url: string
  asset_id?: string | null
  type?: string | null
  label?: string | null
  caption?: string | null
  summary?: string | null
  bucket?: string | null
  object_key?: string | null
  page_number?: number | null
  figure_index?: number | null
  doc_name?: string | null
  mime_type?: string | null
  bbox?: number[] | null
}

interface QueryResponse {
  answer: RAGResult[]
  images?: RagImage[]
  error?: string
}

export async function searchKnowledgeBase(
  question: string,
  noOfSources?: number,
  similarityThreshold?: number,
  extendPublic?: boolean,
  bucketNames?: string[]
): Promise<QueryResponse> {
  return kmApi.post(
    '/manageKnowledge/search',
    {
      question,
      limit: noOfSources,
      similarity_threshold: similarityThreshold ? similarityThreshold / 100 : undefined,
      extend_public: extendPublic,
      bucket_names: bucketNames
    }
  )
}
