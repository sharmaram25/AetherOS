
// The "Aether" Fluid Physics Configuration
export const SPRING_TRANSITION = {
  type: "spring" as const,
  stiffness: 350,
  damping: 25,
  mass: 0.8,
};

export const HOVER_SPRING = {
  type: "spring" as const,
  stiffness: 400,
  damping: 10,
};

export const MENU_TRANSITION = {
  type: "spring" as const,
  stiffness: 300,
  damping: 20,
};

export const DOCK_SPRING = {
  type: "spring" as const,
  stiffness: 250,
  damping: 15,
  mass: 0.5
};
