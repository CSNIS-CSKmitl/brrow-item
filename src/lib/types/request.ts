export type BorrowRequestStatus =
  "pending" | "approved" | "rejected" | "returned";

export interface BorrowRequest {
  id: string;
  user: string;
  item: string;
  quantity: number;
  status: BorrowRequestStatus;
  start_date: string;
  end_date: string;
  purpose?: string;
  created?: string;
  updated?: string;
}
