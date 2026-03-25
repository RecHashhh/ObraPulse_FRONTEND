import { useMemo, useState } from "react";

const TOUR_KEY = "pac.onboarding.completed";

const TOUR_STEPS = [
  {
    page: "dashboard",
    title: "Bienvenido a ObraPulse",
    description: "Aqui monitoreas KPIs y comportamiento general de contratacion en tiempo real.",
  },
  {
    page: "territorial",
    title: "Analisis territorial",
    description: "Haz click en una provincia para activar drill-down y explorar entidades y ciudades.",
  },
  {
    page: "insights",
    title: "Insights accionables",
    description: "Revisa outliers, alertas por umbral y recomendaciones para toma de decisiones.",
  },
  {
    page: "reportes",
    title: "Centro de reportes",
    description: "Exporta CSV/Excel/PDF ejecutivo para compartir resultados con stakeholders.",
  },
];

export default function OnboardingTour({ activePage, onChangePage }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [visible, setVisible] = useState(() => localStorage.getItem(TOUR_KEY) !== "true");

  const step = TOUR_STEPS[stepIndex];

  const progress = useMemo(
    () => `${stepIndex + 1}/${TOUR_STEPS.length}`,
    [stepIndex]
  );

  if (!visible || !step) return null;

  const closeTour = () => {
    localStorage.setItem(TOUR_KEY, "true");
    setVisible(false);
  };

  const goNext = () => {
    if (stepIndex >= TOUR_STEPS.length - 1) {
      closeTour();
      return;
    }

    const nextIndex = stepIndex + 1;
    const nextStep = TOUR_STEPS[nextIndex];
    setStepIndex(nextIndex);
    if (nextStep?.page) {
      onChangePage(nextStep.page);
    }
  };

  const goPrevious = () => {
    if (stepIndex <= 0) return;
    const nextIndex = stepIndex - 1;
    const nextStep = TOUR_STEPS[nextIndex];
    setStepIndex(nextIndex);
    if (nextStep?.page) {
      onChangePage(nextStep.page);
    }
  };

  return (
    <div className="tour-backdrop">
      <section className="tour-card glass-card">
        <small className="tour-progress">Tour {progress}</small>
        <h3>{step.title}</h3>
        <p>{step.description}</p>
        <p className="tour-page-state">
          Vista esperada: <strong>{step.page}</strong> · Vista actual: <strong>{activePage}</strong>
        </p>

        <div className="tour-actions">
          <button className="ghost-btn" onClick={closeTour}>
            Omitir
          </button>
          <div className="tour-nav">
            <button className="ghost-btn" disabled={stepIndex === 0} onClick={goPrevious}>
              Anterior
            </button>
            <button className="primary-btn" onClick={goNext}>
              {stepIndex === TOUR_STEPS.length - 1 ? "Finalizar" : "Siguiente"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
