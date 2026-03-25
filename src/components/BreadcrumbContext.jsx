export default function BreadcrumbContext({ filters }) {
  const items = ["Global"];

  if (filters.provincia) items.push(filters.provincia);
  if (filters.ciudad) items.push(filters.ciudad);
  if (filters.entidad) items.push(filters.entidad);

  return (
    <div className="breadcrumb-context">
      {items.map((item, index) => (
        <span key={item}>
          {item}
          {index < items.length - 1 ? " > " : ""}
        </span>
      ))}
    </div>
  );
}