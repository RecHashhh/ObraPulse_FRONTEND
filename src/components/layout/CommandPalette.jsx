import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";

export default function CommandPalette({
  open,
  onClose,
  actions = [],
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);

  const visibleActions = useMemo(() => {
    const key = query.trim().toLowerCase();
    if (!key) return actions;

    return actions.filter((action) =>
      `${action.label} ${action.description || ""}`.toLowerCase().includes(key)
    );
  }, [actions, query]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelected((prev) => Math.min(visibleActions.length - 1, prev + 1));
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelected((prev) => Math.max(0, prev - 1));
        return;
      }

      if (event.key === "Enter") {
        const action = visibleActions[selected];
        if (action) {
          event.preventDefault();
          action.run();
          onClose();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open, selected, visibleActions]);

  if (!open) return null;

  return (
    <div className="command-palette-backdrop" onClick={onClose}>
      <section className="command-palette" onClick={(event) => event.stopPropagation()}>
        <div className="command-palette-search">
          <Search size={16} />
          <input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelected(0);
            }}
            placeholder="Escribe un comando o una vista..."
          />
        </div>

        <div className="command-palette-list">
          {visibleActions.length ? (
            visibleActions.map((action, index) => (
              <button
                key={action.id}
                className={`command-item ${index === selected ? "active" : ""}`}
                onMouseEnter={() => setSelected(index)}
                onClick={() => {
                  action.run();
                  onClose();
                }}
              >
                <strong>{action.label}</strong>
                {action.description ? <small>{action.description}</small> : null}
              </button>
            ))
          ) : (
            <div className="command-empty">No hay resultados para tu busqueda.</div>
          )}
        </div>
      </section>
    </div>
  );
}
