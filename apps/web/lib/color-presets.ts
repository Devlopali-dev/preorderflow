// Palette de base proposée à la création d'une couleur (/settings) : un clic
// remplit le nom et la pastille. Ce ne sont que des suggestions — l'admin
// peut toujours saisir un nom et choisir n'importe quelle pastille.
// Les valeurs hex sont des données de pastille, pas des styles de l'interface.
export interface ColorPreset {
  name: string;
  hex: string;
}

export const COLOR_PRESETS: ColorPreset[] = [
  { name: "Rouge", hex: "#d62828" },
  { name: "Orange", hex: "#f77f00" },
  { name: "Jaune", hex: "#fcbf49" },
  { name: "Vert", hex: "#2a9d3f" },
  { name: "Turquoise", hex: "#1fb5ad" },
  { name: "Bleu", hex: "#1d4ed8" },
  { name: "Marine", hex: "#14213d" },
  { name: "Violet", hex: "#7b2cbf" },
  { name: "Rose", hex: "#f06595" },
  { name: "Bordeaux", hex: "#6d1a36" },
  { name: "Marron", hex: "#7f5539" },
  { name: "Beige", hex: "#e0c9a6" },
  { name: "Kaki", hex: "#7d8451" },
  { name: "Gris", hex: "#8d99ae" },
  { name: "Blanc", hex: "#f8f9fa" },
  { name: "Noir", hex: "#111111" },
];
