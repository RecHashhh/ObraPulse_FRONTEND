import AdvancedTable from "../ui/AdvancedTable";

export default function DetailTableBlock({
  data,
  page,
  total,
  pageSize,
  onPageChange,
  globalSearch,
  onAddBookmark,
  bookmarkedIds = [],
}) {
  return (
    <AdvancedTable
      data={data}
      page={page}
      total={total}
      pageSize={pageSize}
      onPageChange={onPageChange}
      globalSearch={globalSearch}
      onAddBookmark={onAddBookmark}
      bookmarkedIds={bookmarkedIds}
    />
  );
}
