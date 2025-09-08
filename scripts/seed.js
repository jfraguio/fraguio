import Database from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'data', 'blog.sqlite3');
const db = new Database.Database(dbPath);

const samplePosts = [
  {
    title: "El susurro del viento",
    content: "En las tardes de otoño, cuando el sol declina y las hojas danzan al compás de una brisa melancólica, me encuentro contemplando la vastedad del cielo.\n\nHay algo en esa quietud que abraza el alma, una sensación de pertenencia a algo mucho más grande que nosotros mismos. El viento cuenta historias de lugares lejanos, de sueños que se desvanecen y esperanzas que renacen.\n\nCada ráfaga es un verso, cada silencio una pausa poética que nos invita a reflexionar sobre la belleza efímera de la existencia.",
    is_pinned: 1
  },
  {
    title: "Fragmentos de una tarde lluviosa",
    content: "La lluvia golpea suavemente contra la ventana, creando una sinfonía íntima que envuelve la habitación en una atmósfera de recogimiento.\n\nMiro las gotas deslizarse por el cristal, cada una trazando un camino único, como las decisiones que tomamos en la vida. Algunas se precipitan hacia abajo con determinación, otras vacilan, se unen a sus compañeras o se detienen en el camino.\n\nEn estos momentos de pausa, cuando el mundo exterior se vuelve difuso tras el velo de agua, encuentro la claridad que a menudo me elude en los días soleados.",
    is_pinned: 1
  },
  {
    title: "Nocturno urbano",
    content: "Las luces de la ciudad parpadean como estrellas terrestres, cada ventana iluminada contando una historia silenciosa.\n\nCamino por las calles vacías de madrugada, cuando la urbe revela su rostro más auténtico. Los edificios se alzan como gigantes dormidos, y el eco de mis pasos resuena en el asfalto húmedo.\n\nHay una poesía particular en la soledad urbana, una belleza melancólica que solo se revela a quienes se atreven a explorar la ciudad en sus horas más íntimas.",
    is_pinned: 0
  },
  {
    title: "El jardín secreto de la memoria",
    content: "Los recuerdos florecen en los rincones más inesperados de la mente, como flores silvestres que crecen entre las grietas del pavimento.\n\nHoy, mientras ordenaba unos libros viejos, encontré una fotografía que me transportó instantáneamente a aquel verano de hace tantos años. El aroma de las rosas del jardín de mi abuela, el sabor del agua fresca del pozo, la sensación de la hierba bajo los pies descalzos.\n\nEs fascinante cómo ciertos objetos pueden actuar como llaves que abren puertas hacia universos enteros que creíamos perdidos.",
    is_pinned: 0
  },
  {
    title: "Diálogo con el horizonte",
    content: "Desde este acantilado, el horizonte se extiende como una línea infinita que separa y une al mismo tiempo cielo y mar.\n\nMe pregunto qué habrá más allá de esa línea imaginaria, qué mundos se ocultan tras la curvatura de la Tierra. El horizonte es una promesa y un misterio, una invitación constante al viaje y al descubrimiento.\n\nPero quizás lo más hermoso del horizonte es que siempre está ahí, constante e inalcanzable, recordándonos que hay algo más allá de nuestro campo de visión, algo que vale la pena buscar.",
    is_pinned: 1
  }
];

// Generar más entradas para llegar a 120
const additionalTitles = [
  "Reflexiones al amanecer", "El eco de las palabras no dichas", "Cartografía del alma", 
  "Los colores del silencio", "Temporada de luciérnagas", "El peso de las ausencias",
  "Geografía íntima", "Las horas pequeñas", "Mapas de la nostalgia", "El rumor del tiempo",
  "Biblioteca de los sueños", "Crónicas del desvelo", "El alfabeto del viento",
  "Postal desde el pasado", "Los domingos del alma", "Arquitectura de la esperanza",
  "El jardín de los sentidos", "Navegante de madrugadas", "Los pasos perdidos",
  "Caleidoscopio interior", "El museo de los instantes", "Territorios del corazón"
];

const contentTemplates = [
  "En la quietud de {moment}, me encuentro reflexionando sobre {theme}.\n\nHay algo profundamente conmovedor en {observation}, una verdad que solo se revela cuando prestamos atención a los detalles más sutiles de la existencia.\n\n{philosophical_thought}",
  "Las {element} me recuerdan constantemente que {insight}.\n\nCuando observo {scene}, siento una conexión profunda con algo que trasciende lo cotidiano. Es en estos momentos cuando comprendo que {realization}.\n\n{conclusion}",
  "Hoy, mientras {activity}, descubrí que {discovery}.\n\nEs fascinante cómo {mechanism} puede transformar completamente nuestra percepción de {subject}. La vida está llena de estas pequeñas revelaciones que, como {metaphor}, iluminan aspectos ocultos de nuestra experiencia.\n\n{reflection}"
];

const moments = ["las primeras horas del día", "las tardes de invierno", "los atardeceres de verano", "las noches sin luna"];
const themes = ["la naturaleza efímera del tiempo", "los vínculos invisibles que nos conectan", "la belleza de lo imperfecto"];
const observations = ["la danza de las sombras en la pared", "el ritmo pausado de la respiración", "la forma en que la luz se fragmenta"];
const elements = ["hojas", "nubes", "estrellas", "gotas de rocío"];

function generateContent() {
  const template = contentTemplates[Math.floor(Math.random() * contentTemplates.length)];
  return template
    .replace('{moment}', moments[Math.floor(Math.random() * moments.length)])
    .replace('{theme}', themes[Math.floor(Math.random() * themes.length)])
    .replace('{observation}', observations[Math.floor(Math.random() * observations.length)])
    .replace('{philosophical_thought}', "Quizás la verdadera sabiduría reside en aprender a habitar estos espacios de contemplación.")
    .replace('{element}', elements[Math.floor(Math.random() * elements.length)])
    .replace('{insight}', "la vida es una constante invitación al asombro")
    .replace('{scene}', "el mundo a través de la ventana")
    .replace('{realization}', "estamos rodeados de pequeños milagros cotidianos")
    .replace('{conclusion}', "En la simplicidad encontramos la complejidad del ser.")
    .replace('{activity}', "caminaba por el parque")
    .replace('{discovery}', "cada paso puede ser una revelación")
    .replace('{mechanism}', "la atención plena")
    .replace('{subject}', "nuestro entorno")
    .replace('{metaphor}', "faros en la niebla")
    .replace('{reflection}', "La vida es un texto que escribimos y leemos simultáneamente.");
}

db.serialize(() => {
  // Verificar si ya hay datos
  db.get('SELECT COUNT(*) as count FROM posts', (err, row) => {
    if (err) {
      console.error('Error checking database:', err);
      return;
    }
    
    if (row.count > 0) {
      console.log('Database already has posts. Skipping seed.');
      db.close();
      return;
    }
    
    console.log('Seeding database with sample posts...');
    
    // Insertar posts de ejemplo
    const stmt = db.prepare('INSERT INTO posts (title, content, is_pinned) VALUES (?, ?, ?)');
    
    // Insertar los posts definidos
    samplePosts.forEach(post => {
      stmt.run(post.title, post.content, post.is_pinned);
    });
    
    // Generar posts adicionales hasta llegar a 120
    const totalPosts = 120;
    const remainingPosts = totalPosts - samplePosts.length;
    
    for (let i = 0; i < remainingPosts; i++) {
      const titleIndex = i % additionalTitles.length;
      const title = additionalTitles[titleIndex] + (i >= additionalTitles.length ? ` ${Math.floor(i / additionalTitles.length) + 1}` : '');
      const content = generateContent();
      const is_pinned = Math.random() < 0.1 ? 1 : 0; // 10% de probabilidad de ser fijado
      
      stmt.run(title, content, is_pinned);
    }
    
    stmt.finalize((err) => {
      if (err) {
        console.error('Error seeding database:', err);
      } else {
        console.log(`✓ Database seeded with ${totalPosts} posts`);
      }
      db.close();
    });
  });
});
