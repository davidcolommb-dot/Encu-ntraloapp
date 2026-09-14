import { uid } from "../utils/ids";
import { todayISO, daysFromNow } from "../utils/dates";

export const SEED_PUESTOS = [
  {
    id: "seed-puesto-picker-salidas",
    name: "[Ejemplo] Picker de Salidas — Almacén",
    deadlineDays: 15,
    checklistItems: [
      // Conocimiento
      { id: "spk-c1", category: "conocimiento", text: "Conoce el sistema de fichajes: cómo y cuándo fichar" },
      { id: "spk-c2", category: "conocimiento", text: "Conoce la organización logística del almacén: estructura, flujos y funcionamiento del equipo" },
      { id: "spk-c3", category: "conocimiento", text: "Ha completado la formación PRL obligatoria y su test" },
      { id: "spk-c4", category: "conocimiento", text: "Sabe cómo se organizan las playas y naves: dónde va la agencia, la mensajería y la ruta" },
      { id: "spk-c5", category: "conocimiento", text: "Conoce el sistema de objetivos e incentivos del picker, y cómo se miden" },
      { id: "spk-c6", category: "conocimiento", text: "Conoce el procedimiento de faltas de otros almacenes (Constitución, Martorell)" },
      // Habilidad
      { id: "spk-h1", category: "habilidad", text: "Domina el proceso completo de preparación de pedidos: metodología, orden de trabajo y herramientas" },
      { id: "spk-h2", category: "habilidad", text: "Sabe conducir y manejar la maquinaria (preparadoras) con soltura y de forma segura" },
      { id: "spk-h3", category: "habilidad", text: "Maneja la PDA: navegación básica, lectura de pedidos y confirmación de líneas" },
      { id: "spk-h4", category: "habilidad", text: "Sabe clasificar la tipología de producto y montar un palé de forma estable y optimizada" },
      { id: "spk-h5", category: "habilidad", text: "Usa correctamente la etiquetadora y la flejadora" },
      { id: "spk-h6", category: "habilidad", text: "Resuelve con soltura la casuística de Mensajería / Amazon / Makro" },
      { id: "spk-h7", category: "habilidad", text: "Resuelve con soltura la casuística de Agencia estándar" },
      { id: "spk-h8", category: "habilidad", text: "Resuelve con soltura la casuística de Ruta (con y sin camión)" },
      { id: "spk-h9", category: "habilidad", text: "Aplica correctamente el checklist de calidad al montar un pedido (trazabilidad, producto, palé, etiquetado y embalaje)" },
      // Aptitud
      { id: "spk-a1", category: "aptitud", text: "Cumple los turnos y estándares de orden y limpieza (rutinas QR) sin necesidad de recordatorio" },
      { id: "spk-a2", category: "aptitud", text: "Aplica las buenas prácticas de calidad y eficiencia del almacén de forma constante, no solo cuando le supervisan" },
      { id: "spk-a3", category: "aptitud", text: "Es capaz de trabajar de forma autónoma, sabiendo cuándo pedir ayuda a su responsable" },
      { id: "spk-a4", category: "aptitud", text: "Muestra ritmo de aprendizaje adecuado y pide ayuda ante dudas en vez de arriesgarse a fallar" },
    ],
  },
];

export const SEED_COURSES = [
  {
    id: uid(),
    title: "[Ejemplo] Cómo usar el Aula Virtual — tutorial completo",
    category: "generica",
    description:
      "Formación de bienvenida, actualizada con todo lo que hay hoy en el Aula Virtual: el Catálogo y sus filtros, cómo completar una formación (incluidos casos prácticos), formaciones por módulos, Rutas de aprendizaje, y tu progreso. 5 módulos cortos, cada uno con su test rápido.",
    videoUrl: "",
    presentationUrl: "",
    deadline: "",
    testMode: "interno",
    passPct: 70,
    attachments: [],
    modules: [
      {
        id: "m1",
        title: "1. Bienvenida y cómo entrar",
        videoUrl: "",
        body:
          "El Aula Virtual es donde encuentras toda tu formación: protocolos, formación general, específica de tu equipo, y contenidos de IA. Cada formación trae su vídeo o material, y una forma de confirmar que la has entendido (un test, o a veces solo \"ya la he visto\").\n\n" +
          "CÓMO ENTRAR\n" +
          "Escribes tu nombre y apellido tal como está registrado, y pulsas \"Continuar\".\n\n" +
          "LA PRIMERA VEZ es distinta: como no tienes contraseña todavía, te pedimos tu email (el que el administrador registró) para comprobar que eres tú, y luego creas tu contraseña — mínimo 6 caracteres.\n\n" +
          "LAS SIGUIENTES VECES solo hace falta tu nombre y esa contraseña. El navegador recuerda tu sesión, así que no te la vuelve a pedir hasta que pulses \"Cerrar sesión\".\n\n" +
          "SI TE BLOQUEAS: nadie puede \"ver\" tu contraseña, ni el administrador — pero sí puede restablecerla, y volverás a crear una nueva verificando tu email, igual que la primera vez.",
        quiz: [
          {
            question: "¿Qué necesitas la PRIMERA vez que entras, además de tu nombre?",
            options: ["Tu DNI", "Verificar tu email para poder crear tu contraseña", "El PIN que te dé un compañero", "Nada más, ya tienes contraseña desde el principio"],
            correct: 1,
          },
          {
            question: "Si olvidas tu contraseña, ¿qué puede hacer el administrador?",
            options: ["Ver tu contraseña actual y decírtela", "Restablecerla, para que crees una nueva verificando tu email", "Nada, no hay solución", "Borrar tu cuenta y crear una nueva"],
            correct: 1,
          },
        ],
        passPct: 70,
      },
      {
        id: "m2",
        title: "2. El Catálogo: encuentra lo tuyo",
        videoUrl: "",
        body:
          "El Catálogo organiza todo en 4 campos: Protocolos, Formación genérica, Formación específica, e IA y nuevas tecnologías.\n\n" +
          "DE UN VISTAZO, ANTES DE ENTRAR\n" +
          "Cada campo muestra un número en rojo con tus pendientes de ese campo — cuentan aunque la formación no tenga fecha límite puesta, lo único que importa es que esté asignada y sin completar. Arriba del todo también ves el total de pendientes entre todos los campos.\n\n" +
          "FILTRAR POR DEPARTAMENTO\n" +
          "Si tu empresa usa departamentos, verás unos chips (\"Almacén\", \"Administración\"...) para filtrar solo lo de un departamento. Las formaciones marcadas como \"General / Interdepartamental\" se ven siempre, filtres por donde filtres — son para todo el mundo.\n\n" +
          "BUSCADOR\n" +
          "Busca por título, y también encuentra contenido dentro de los módulos de una formación, no solo el título general.",
        quiz: [
          {
            question: "El número rojo en cada campo del Catálogo, ¿cuenta solo las formaciones con fecha límite?",
            options: ["Sí, solo esas", "No — cuenta cualquier pendiente, tenga fecha o no", "Solo si son protocolos", "Ese número no existe"],
            correct: 1,
          },
          {
            question: "Una formación \"General / Interdepartamental\", ¿cuándo se ve en el Catálogo?",
            options: ["Solo si no filtras por ningún departamento", "Siempre, filtres por el departamento que filtres", "Nunca, hay que ir a buscarla aparte", "Solo la ve el administrador"],
            correct: 1,
          },
        ],
        passPct: 70,
      },
      {
        id: "m3",
        title: "3. Completar una formación",
        videoUrl: "",
        body:
          "Al abrir una formación encuentras, según lo que tenga: un vídeo, documentos para descargar, y la forma de confirmarla.\n\n" +
          "SI TIENE TEST: respondes las preguntas y necesitas el porcentaje mínimo para aprobar. Si no llegas, puedes reintentarlo.\n" +
          "SI NO TIENE TEST: verás un botón \"Ya la he visto\" — con eso basta.\n" +
          "SI ES UN GOOGLE FORM: lo rellenas fuera, y luego confirmas aquí que ya lo hiciste.\n\n" +
          "CASO PRÁCTICO (si la formación lo tiene)\n" +
          "Es un ejercicio de respuesta libre — escribes tu respuesta a un caso concreto. No hay \"correcto\" o \"incorrecto\" al momento: tu responsable o un administrador lo revisa después y te deja una corrección. Enviarlo cuenta para completar la formación; no hace falta esperar a que te lo corrijan para seguir con tu día.\n\n" +
          "AL TERMINAR: te pedimos que la valores con estrellas — es el último paso para que cuente como completada del todo.\n\n" +
          "RECERTIFICACIÓN: si una formación caduca cada cierto tiempo, cuando pase ese plazo te volverá a aparecer como pendiente automáticamente. No es un error ni tienes que hacer nada especial, solo repetirla.",
        quiz: [
          {
            question: "Si una formación tiene caso práctico, ¿hace falta esperar a que te lo corrijan para que cuente como completada?",
            options: ["Sí, hasta que llega la corrección no cuenta", "No — enviarlo ya cuenta; la corrección llega después, aparte", "Solo si lo corrige un administrador, no un responsable", "Los casos prácticos nunca se corrigen"],
            correct: 1,
          },
          {
            question: "¿Qué es lo último que hace falta para que una formación cuente como completada del todo?",
            options: ["Nada más, con el test aprobado ya está siempre", "Valorarla con estrellas", "Descargar todos los documentos", "Compartirla con un compañero"],
            correct: 1,
          },
          {
            question: "Una formación que caduca cada cierto tiempo y ya completaste, ¿qué pasa cuando pasa ese plazo?",
            options: ["Desaparece del todo, hay que pedirla de nuevo al administrador", "Te vuelve a aparecer como pendiente sola, hay que repetirla", "Sigue contando como completada para siempre", "Se archiva y ya no se puede hacer"],
            correct: 1,
          },
        ],
        passPct: 70,
      },
      {
        id: "m4",
        title: "4. Formaciones por módulos y Rutas",
        videoUrl: "",
        body:
          "Algunas formaciones (como esta misma) están divididas en módulos que se van desbloqueando uno a uno, en orden.\n\n" +
          "QUÉ PUEDE PEDIR UN MÓDULO PARA DESBLOQUEAR EL SIGUIENTE\n" +
          "· Su propio test (lo normal)\n" +
          "· Una formación relacionada marcada como \"requisito\" — hay que completarla antes de seguir\n" +
          "· Un checklist rápido de pasos a marcar (distinto del test)\n" +
          "· Su propio caso práctico\n" +
          "Puede pedir varias de estas cosas a la vez — el módulo no se da por aprobado hasta que todo lo que tenga puesto esté hecho.\n\n" +
          "RUTAS DE APRENDIZAJE\n" +
          "Una Ruta encadena varias formaciones completas en un orden sugerido (no bloqueante como los módulos). Si eres nuevo en la empresa, es posible que tengas una \"ruta de bienvenida\" asignada automáticamente desde el primer día, sin que nadie tenga que hacerlo a mano.",
        quiz: [
          {
            question: "Si un módulo tiene una formación \"requisito\", ¿qué pasa si no la has completado?",
            options: ["No importa, el módulo se aprueba igual con el test", "El módulo no se da por aprobado hasta que completes esa formación", "Se salta automáticamente", "Solo afecta a otros compañeros, no a ti"],
            correct: 1,
          },
          {
            question: "¿Qué diferencia hay entre una Ruta y una formación por módulos?",
            options: ["Ninguna, son lo mismo con otro nombre", "La Ruta encadena formaciones completas; los módulos son partes DENTRO de una misma formación", "Las Rutas no existen en esta versión", "Los módulos son solo para administradores"],
            correct: 1,
          },
        ],
        passPct: 70,
      },
      {
        id: "m5",
        title: "5. Tu progreso, y si gestionas un equipo",
        videoUrl: "",
        body:
          "Cada formación completada suma puntos, que te dan un nivel. También vas ganando insignias: por tu primera formación, por llegar a 5 y a 10, por dominar todas las de un campo (\"Experto en...\"), por estar al día con todo, y por completar una Ruta entera.\n\n" +
          "Archivar una formación (algo que hace el administrador para despejar el Catálogo) nunca te quita puntos ni insignias que ya hubieras ganado — lo que ya hiciste, hecho está.\n\n" +
          "SI ERES RESPONSABLE DE UN EQUIPO\n" +
          "Verás una pestaña extra, \"Mi equipo\", con el estado de cumplimiento de tu gente, quién tiene algo vencido, y si tu departamento tiene algún Puesto con checklist de conocimientos, podrás evaluarlo ahí — eso lo hace siempre el responsable, no la propia persona.\n\n" +
          "Cualquier duda que esta formación no resuelva, pregunta a tu responsable o a quien se indique en cada formación concreta.",
        quiz: [
          {
            question: "Si el administrador archiva una formación que tú ya completaste, ¿pierdes los puntos que ganaste por ella?",
            options: ["Sí, se restan automáticamente", "No — lo que ya ganaste se queda, archivar solo la quita del Catálogo", "Solo si tenía caso práctico", "Depende del campo en el que estuviera"],
            correct: 1,
          },
          {
            question: "El checklist de conocimientos de un Puesto, ¿quién lo rellena?",
            options: ["Cada persona sobre sí misma", "Su responsable (o un administrador), nunca la propia persona", "Se rellena solo automáticamente", "Recursos Humanos, por correo"],
            correct: 1,
          },
        ],
        passPct: 70,
      },
    ],
  },
  {
    id: uid(),
    title: "[Ejemplo] Seguridad básica en el almacén",
    category: "protocolos",
    description:
      "Formación de ejemplo sobre hábitos básicos de seguridad en el almacén: manipulación de cargas, orden y limpieza, EPIs y qué hacer ante un incidente. Sustituye el vídeo por el vuestro real cuando queráis, o dejad este como referencia de formato.",
    videoUrl: "https://www.youtube.com/watch?v=ySXc8tbw8VA",
    presentationUrl: "",
    deadline: daysFromNow(3),
    testMode: "interno",
    passPct: 70,
    attachments: [{ name: "Seguridad básica en el almacén.pdf", mimeType: "application/pdf", sizeKB: 5.4, data: "data:application/pdf;base64,JVBERi0xLjQKJZOMi54gUmVwb3J0TGFiIEdlbmVyYXRlZCBQREYgZG9jdW1lbnQgKG9wZW5zb3VyY2UpCjEgMCBvYmoKPDwKL0YxIDIgMCBSIC9GMiAzIDAgUiAvRjMgNCAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL0Jhc2VGb250IC9IZWx2ZXRpY2EgL0VuY29kaW5nIC9XaW5BbnNpRW5jb2RpbmcgL05hbWUgL0YxIC9TdWJ0eXBlIC9UeXBlMSAvVHlwZSAvRm9udAo+PgplbmRvYmoKMyAwIG9iago8PAovQmFzZUZvbnQgL0hlbHZldGljYS1Cb2xkIC9FbmNvZGluZyAvV2luQW5zaUVuY29kaW5nIC9OYW1lIC9GMiAvU3VidHlwZSAvVHlwZTEgL1R5cGUgL0ZvbnQKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL0Jhc2VGb250IC9aYXBmRGluZ2JhdHMgL05hbWUgL0YzIC9TdWJ0eXBlIC9UeXBlMSAvVHlwZSAvRm9udAo+PgplbmRvYmoKNSAwIG9iago8PAovQ29udGVudHMgMTAgMCBSIC9NZWRpYUJveCBbIDAgMCA1OTUuMjc1NiA4NDEuODg5OCBdIC9QYXJlbnQgOSAwIFIgL1Jlc291cmNlcyA8PAovRXh0R1N0YXRlIDw8Ci9nUkxzMCA8PAovY2EgLjEyCj4+IC9nUkxzMSA8PAovY2EgMQo+Pgo+PiAvRm9udCAxIDAgUiAvUHJvY1NldCBbIC9QREYgL1RleHQgL0ltYWdlQiAvSW1hZ2VDIC9JbWFnZUkgXQo+PiAvUm90YXRlIDAgL1RyYW5zIDw8Cgo+PiAKICAvVHlwZSAvUGFnZQo+PgplbmRvYmoKNiAwIG9iago8PAovQ29udGVudHMgMTEgMCBSIC9NZWRpYUJveCBbIDAgMCA1OTUuMjc1NiA4NDEuODg5OCBdIC9QYXJlbnQgOSAwIFIgL1Jlc291cmNlcyA8PAovRXh0R1N0YXRlIDw8Ci9nUkxzMCA8PAovY2EgLjEyCj4+IC9nUkxzMSA8PAovY2EgMQo+Pgo+PiAvRm9udCAxIDAgUiAvUHJvY1NldCBbIC9QREYgL1RleHQgL0ltYWdlQiAvSW1hZ2VDIC9JbWFnZUkgXQo+PiAvUm90YXRlIDAgL1RyYW5zIDw8Cgo+PiAKICAvVHlwZSAvUGFnZQo+PgplbmRvYmoKNyAwIG9iago8PAovUGFnZU1vZGUgL1VzZU5vbmUgL1BhZ2VzIDkgMCBSIC9UeXBlIC9DYXRhbG9nCj4+CmVuZG9iago4IDAgb2JqCjw8Ci9BdXRob3IgKFwoYW5vbnltb3VzXCkpIC9DcmVhdGlvbkRhdGUgKEQ6MjAyNjA4MjQxMjE4MzIrMDAnMDAnKSAvQ3JlYXRvciAoXCh1bnNwZWNpZmllZFwpKSAvS2V5d29yZHMgKCkgL01vZERhdGUgKEQ6MjAyNjA4MjQxMjE4MzIrMDAnMDAnKSAvUHJvZHVjZXIgKFJlcG9ydExhYiBQREYgTGlicmFyeSAtIFwob3BlbnNvdXJjZVwpKSAKICAvU3ViamVjdCAoXCh1bnNwZWNpZmllZFwpKSAvVGl0bGUgKFNlZ3VyaWRhZCBiXDM0MXNpY2EgZW4gZWwgYWxtYWNcMzUxbikgL1RyYXBwZWQgL0ZhbHNlCj4+CmVuZG9iago5IDAgb2JqCjw8Ci9Db3VudCAyIC9LaWRzIFsgNSAwIFIgNiAwIFIgXSAvVHlwZSAvUGFnZXMKPj4KZW5kb2JqCjEwIDAgb2JqCjw8Ci9GaWx0ZXIgWyAvQVNDSUk4NURlY29kZSAvRmxhdGVEZWNvZGUgXSAvTGVuZ3RoIDI1NzEKPj4Kc3RyZWFtCkdiISNdOWxvJ3QoPlxqaEAmXDVeUUpcRkJDSyV1Q2heIVZmaW4nR1MmLiRKS09HIVtzQz8vYVpFcmYxNSt1czNRL05mVW0oNVwqMUs2LEAlSjBQaWgtWl02RlJeJksnZm9RL2k9OzgqckhQV0dEYiY2K0FsZUFJOT0kYC1haU5jaVcnSjhsdFoyWlpIV3M1LFEsUl1KMm4kP1JAYC8/MFozQVppU3MpOF5LZDR1NlswdTpuXjUxKHQrV0ZKMEksMDRIL0FOcSEmN1hcQkEqb3RMaCk2cFtXT3Usc1VHJEQ8K3FzSClZLFE1UTBlbEZvO10vWDAlVD1Ub2Q1RiNxRT9HMGdXTzZsUnEwPzRFWD9zLzBRblE3X284SyteMl9jXGhdcCcyP3FvWlE4WUw7Yj5IWjZXJ0QnXUJZJThYJzQxWylmTFkoMV1pRy1lWCM/PDNTPWlaNyUxSHApNzojKC1pWCJfb2NJaTMxL2FUS2VKJCU6UjQ3W2lNLkB0cFFfLyVANkw6SCMjOm1WVzE7U2djcGtLSmtYc1VXJ1ZCb2srNCRVQSsmRnJTKz1ZO2E3NipkQ1x0aF8ySSldPSNsc2wlS2xxOGNDJDlca0pvJTxKTXAvLnRTVUluanUnbEIuN0podSg2PVlYNzU+aGdXLmUvW2wwcTEuSUQqNy5kT0dfZGQ8cHBiLEdIVFpeVW1zLUZDaVk8c2lpdT5cXD9tJktQOylrbDBOJlJsR29eW1BAQmRkLzREcVI5RTxYJkxDRFNBND9wXEQwWCVYLm4sOG1KPSokaFp0LnA4T2gmUiZXKyFbIV1hZ2FuIjNcMCxdPyZrME1pXG1sN0JEOiljVF9FSW48TUBwQjo+OGQ+dGVaWU4lImFWckYya2AhPWNLTStUTVxRLSgsMnUxIUFnYTBcKjFUU2xjPiEqP048aVM9MEdJRVgrM3BAU21uV0klM20rXEhTQGdaTmQkbEAvLWJmb1VtWD07L0g8SD0iV190dUhKWyxHJWNmTHFvREtSLjM2UlJoT2NUIkMiJVVGYE5cNU8yVVxMb1hTLFMzOlEnIipTTmNjSVNPbjNUZkw8TldCQS9DRFdHJUFMQWEjYCRmP08pQHEnTS1QVTZTOSRuSkBYak8kLiEiTWpDL208LmpjbVcuKk4oMzhdVUdgWmNUYEFsViEzYDlrci0ucWhJdVlqWyxpOz9IZFhxKGRQJzRhRFAhMGFvSiY9dTImUF41NC1kQlh1PjxBTEdtSHUuMklOLio0VVVkZ01CL2h0aFxtWk9sRmhmXE85MDxtdFBcLlw6NkEoPWFTUyMzIyZnXzhDPjFvQFpSQlo9Ij5XLlRYa2BXcmhiJGpePXEoK0xBKEFXQUMrPlJGa1xccDMoUmAmQjhDPnAnR1cpYVlPTThKbG5oZVVaRWllZ09pOm1Sb0QkOV5RXnI+My9JLXEpNzsvczEjKzNwJ00hbUllJzVmZmNlOmFmVTpDWztnVVE4dCc/aS09ZnUmV0R0NEFYJENSMD9GcltYSGJTaFZwaSM1XlVrXUhwU0lmdFUvMXFaXEg1Y01NPGZvUXBfZ1I0b1xxKTNZJEcoJihER0xyQ0w9TWpNSEpKZWJRPycrcjJKITFgR2M8ISJWYj9mYC4hIUk4VldrUmxZLj5QPFlYaXM1PVwsVSU8JTllYGxMXzRdci9hcFcwXz8+IjY5dXU2LjdiYSdQJTJOaWQjWVxrXi9KJyY/TCIxdCRoKHJhNE5aU29NVi4xMlJDc11vKzVZXDRYZlpaITBWMyFtb09kb0EzazQ3dE5CVDFaVzpBZmJfXXBnWSNRdWY8MVdYbW1yISRoYW8/ST1DRUpqO1RXYGJPKTY4PjhMNWRZJGw9XT4tTlduLGw7aWojaGxccWFyOz9hdFgiWTd1TiRjXFsyLmFBU0ZULVE5W2I9IU9dZUQ0Z3AjQltyRjhoVj4oa04yXidHTVVncEhNKDhMSDJLL1NRSXVocThzNUAlbGIxTCYncEBTSDdJJmttaXBFQ1NBJiElY2VMTl1GLlZvKFhfUishYiM9PSpzPUpURSNESk1VM3BCbkRtS1pMRD1IbWYsZGA5aUVTXyxtUlFUQWlNbSZANUllX1FlKEQxJFdhblgkRk5hPTFrJWVia0E5TUNuM0lTJ1xeNDBUXmtxbGtbK0FedC0jbTY2IVdIUTdcaThPJzRQR2c8Lm5oVzZQOSQ1YzU2Z1ZuVmAuXmdyNWFcWjwrPUZpSm5DWmk5PTo6MzljQVw7P1dOXjRdWVQyRVs8PG0rI1UrOmdRWj1DIS1WS1tdWE9Lczk8RURrblYrSCgoQHNxdFAiUlJCTTE0KEssUUA8YjhVXS5UM1Q9YS4oVm9SSVpJTzpgMGAmUSkkP2ZXSSstIj5Mb0NdcHJHWUtoMltDY1c3dC4pLEZPLHVhbzlKR0t1RFU/STpzKElhW0JtWGwybCwsXlAwRkNZRGM6UiI+XTZBPDs4Wic8OHQ9cyFTXD1eMDVkMDYnUElWIjVMSiJePSdiKmxsSWJBSD1lJGtkcmpiN0klZGo0PzFGJ2FEZy50ODIqJGZLaVA3TCUqLCdzZTJXVTEmZ2ddOlY/Ii1JPzVTM2ZKQSlbXmZWdSE6RUZQLl40Nk5WWVU9USldWkorVUNvIzU+MCo2aCU0MVcvSiZVTUdbUiVJazlTRy5UMTUyYnBdOyd1ayVQa1pqISlpdWopPlRVTSQ7ImVBYGBCJUp1Vmg3XTZnPVNPUEZuWDdra0ZpMGUtJVAkbFQuWzFPP0Ywbi5zIiVSUzMhVCpKYyNBbDtKRytwQWs9Kk5lW15AU00haTBtRU89azUicllRcW0/ajMsYzpDLi1WPmpGZTFdPCJxIURlYDIxb29BJmkkPSY3bVNgYTddRGpqTV5yM182PXEzUEYkKENtSiNcK0JqRk8lKE85cSVVPG9vVFVFWHRhIiYjIVhnMl08V2pES0JKYEM5ck4mc3AnQW1PO3JIbSI8cGBTJEpSKyxxbUc/M1stal09biRKRiZpLEA0XkxfcEhucUBCP10xUlc/WUk3cS8yY1dUOCleSVY9WlA7SGg3XTgvbDAmb0dBUktocENTZExGWGxpdUhsRnVAZS0pZyc5cCokNVAkZEBlcFtASD9mNnJVWklWTGpBJjI/aF9lXWliNVpIWCVHWTxfWVIwQV9vV3QoVi1VUCIsNFIyTTJrVWc5S0g5ZipHVzNdMTFmOVFXWko+NzhOOy5XRl1cUD85bTQ8OU9NdS82a2ZTIVNSUlVWLTw5XF41K185aFRgLFYqaTRzT2cmT3BAbl5nZz5QR11pQkxSZ0cucnFZbHNlck5yQzBacE5ea3E1X1pJQEZMMGxePz5VcytGW01TSF0sIU1vOlZwQkduV2xFKWlVMydHbV9tL01YMW5cLjc6S1J+PmVuZHN0cmVhbQplbmRvYmoKMTEgMCBvYmoKPDwKL0ZpbHRlciBbIC9BU0NJSTg1RGVjb2RlIC9GbGF0ZURlY29kZSBdIC9MZW5ndGggOTUyCj4+CnN0cmVhbQpHYiEjWT51MDMvJ1JmR1JcRGpKVD8mNF1zOGJOPyU5TUEsMD8rNmBHUispaEZgIiR0LTJMYlYtbz9qRjNbUmUnKFdqUVU9cUhUWTZtUFAiZTVHXCwiJEBvSC9TNlFVSiFBJi8/NnNeIz4ubF5tMipbVnFmVzFQRXAmSkREdWhNdTIoOyZHZ1ZlNFVFWlZeXzpqUW5pJlciUGIlb11TTkItYTFyN0FmU3BhMTFEZV07YD8nL0BCbnFES1VlP1YkTy81LTcrQHMuIUBNKzYoIVJrdVsuVihxM18zcWFiKk5UO1hfZUdaX3BhSnA7b0RBXEFtcFVNPnIlKCkmZF9sW2ljXk0mU0xocm1IJi5IRlluXFRcbyRiQD47MzpeYFIsOilSM0hqaThnI1RfLjI3MCJUTDMrX05EZG8wNlFXImhqZ2FnSm9LSGYwXDxfZGokSz1NYitFKWBfOkchdWUhaGNpXyU6N25OWGBTaTYpMU9lbWg6JDNORVYmc3R0YSVIUU1HXmRCXUhqQDI3Q0hqNEErLDlZSChYXm9HMid1Nk5DOy1JMT1BYmYlUTVVWzEoJ1k7KGlaai9mMENpaiEkRGAiajdtb2VUNSghIydMXEM1ciNYTW5AbmA8PCFKZVlfOG02cXAjUD1qQSouRjpSOy08bm9bI1tSbiU5V00vN3EhKmpPNHMwTnFEaiZBK24vP1omYilyKC0qbTFIVjFbSWhNPHBUaVxIaEpYYFlGJ2dYUl10cS1gcUYjOUdCc0EwU2UmcChKVVBYSiM8TEAqOSRzJys5b0Y+c00kZGwmRDRcKChPKz1uTWdlLyFhalhOakhkUVRiMytWUWo8KkAycTcoVGIuOVk3W101Silla2g2N0xIY1Q+N2htW0ZhS1c9RWkyYEQiXlJmdVYoYnBsKD82b29tcEJYU25SXl8hJ1JvXzYoSF1xND9Pa3RfImIvTiNtbk5ca0k9aU9uTzFCX2kqSFwpPTdiJSZzZkdcTipOLCdsPT5qRSFhYDMuZTJHPUgnMGA3WEM4MWNEMjs5ZSJrVVQ7byJuTD03ZiY+ZypbJzFxTGZVSzA8aCxtNnUkTGVoWnE2RjpeQztlcy5RLWY7IjRpYDomWVc1c2ZNT0xLZzIwZyhmbClgQkBSRDNzLiElOyZWMEApT2RQbE1qZSdARGt1TkNJZCgvRT5BOytgNHRqWiw7LmBdVkBFMSdjT0VcXmcrSkNfTFpbOTMrSUdYREtrRGgxZVBNdFhhPEE9NFZbZG1eUH4+ZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgMTIKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDYxIDAwMDAwIG4gCjAwMDAwMDAxMTIgMDAwMDAgbiAKMDAwMDAwMDIxOSAwMDAwMCBuIAowMDAwMDAwMzMxIDAwMDAwIG4gCjAwMDAwMDA0MTQgMDAwMDAgbiAKMDAwMDAwMDY3NSAwMDAwMCBuIAowMDAwMDAwOTM2IDAwMDAwIG4gCjAwMDAwMDEwMDQgMDAwMDAgbiAKMDAwMDAwMTMwNyAwMDAwMCBuIAowMDAwMDAxMzcyIDAwMDAwIG4gCjAwMDAwMDQwMzUgMDAwMDAgbiAKdHJhaWxlcgo8PAovSUQgCls8OTYwNmFhMDc2ZmY2OGZjMDcxOGRiYWQzYzBiNTgyYTE+PDk2MDZhYTA3NmZmNjhmYzA3MThkYmFkM2MwYjU4MmExPl0KJSBSZXBvcnRMYWIgZ2VuZXJhdGVkIFBERiBkb2N1bWVudCAtLSBkaWdlc3QgKG9wZW5zb3VyY2UpCgovSW5mbyA4IDAgUgovUm9vdCA3IDAgUgovU2l6ZSAxMgo+PgpzdGFydHhyZWYKNTA3OAolJUVPRgo=" }],
    quiz: [
      {
        question: "¿Cuál es la forma correcta de levantar una caja pesada del suelo?",
        options: ["Doblando solo la espalda", "Doblando las rodillas y manteniendo la espalda recta", "Girando el tronco mientras la levantas", "De un tirón rápido, cuanto antes mejor"],
        correct: 1,
      },
      {
        question: "Si detectas un derrame o un obstáculo en un pasillo, ¿qué debes hacer primero?",
        options: ["Pasar con cuidado y seguir tu tarea", "Esperar a que otra persona lo vea", "Señalizarlo y avisar para que se retire antes de que alguien tropiece", "Ignorarlo si no es tu zona"],
        correct: 2,
      },
      {
        question: "¿Por qué es importante mantener el orden y la limpieza en el almacén?",
        options: ["Solo por estética", "Porque reduce accidentes y mejora la eficiencia del trabajo", "No tiene relación con la seguridad", "Solo importa el día de una auditoría"],
        correct: 1,
      },
      {
        question: "¿Qué debes hacer si sufres o presencias un accidente laboral, por pequeño que sea?",
        options: ["Solo avisar si hay sangre visible", "Esperar a ver si empeora antes de avisar", "No decir nada si no duele mucho", "Comunicarlo siempre a tu responsable, aunque parezca leve"],
        correct: 3,
      },
      {
        question: "¿Qué equipo de protección individual (EPI) es habitual en zonas con circulación de carretillas?",
        options: ["Calzado de seguridad y chaleco de alta visibilidad", "Ninguno si conoces bien el almacén", "Solo guantes, el resto es opcional", "Gafas de sol"],
        correct: 0,
      },
      {
        question: "Antes de mover una carga pesada, ¿qué deberías evaluar?",
        options: ["Nada, cuanto antes se mueva mejor", "El peso y si necesitas ayuda o un equipo mecánico", "Solo el color de la etiqueta", "Si hay alguien mirando"],
        correct: 1,
      },
    ],
  },
  {
    id: uid(),
    title: "[Ejemplo] Bienvenida y funcionamiento del Aula Virtual",
    category: "generica",
    description:
      "Formación de ejemplo pensada para la incorporación de cualquier persona nueva al equipo: qué es el Aula Virtual, cómo se usa, y qué se espera de cada formación. Plantilla lista para adaptar con vuestro contenido real de bienvenida.",
    videoUrl: "",
    presentationUrl: "",
    deadline: "",
    testMode: "interno",
    passPct: 70,
    attachments: [{ name: "Bienvenida al Aula Virtual.pdf", mimeType: "application/pdf", sizeKB: 3.6, data: "data:application/pdf;base64,JVBERi0xLjQKJZOMi54gUmVwb3J0TGFiIEdlbmVyYXRlZCBQREYgZG9jdW1lbnQgKG9wZW5zb3VyY2UpCjEgMCBvYmoKPDwKL0YxIDIgMCBSIC9GMiAzIDAgUiAvRjMgNCAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL0Jhc2VGb250IC9IZWx2ZXRpY2EgL0VuY29kaW5nIC9XaW5BbnNpRW5jb2RpbmcgL05hbWUgL0YxIC9TdWJ0eXBlIC9UeXBlMSAvVHlwZSAvRm9udAo+PgplbmRvYmoKMyAwIG9iago8PAovQmFzZUZvbnQgL0hlbHZldGljYS1Cb2xkIC9FbmNvZGluZyAvV2luQW5zaUVuY29kaW5nIC9OYW1lIC9GMiAvU3VidHlwZSAvVHlwZTEgL1R5cGUgL0ZvbnQKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL0Jhc2VGb250IC9aYXBmRGluZ2JhdHMgL05hbWUgL0YzIC9TdWJ0eXBlIC9UeXBlMSAvVHlwZSAvRm9udAo+PgplbmRvYmoKNSAwIG9iago8PAovQ29udGVudHMgOSAwIFIgL01lZGlhQm94IFsgMCAwIDU5NS4yNzU2IDg0MS44ODk4IF0gL1BhcmVudCA4IDAgUiAvUmVzb3VyY2VzIDw8Ci9FeHRHU3RhdGUgPDwKL2dSTHMwIDw8Ci9jYSAuMTIKPj4gL2dSTHMxIDw8Ci9jYSAxCj4+Cj4+IC9Gb250IDEgMCBSIC9Qcm9jU2V0IFsgL1BERiAvVGV4dCAvSW1hZ2VCIC9JbWFnZUMgL0ltYWdlSSBdCj4+IC9Sb3RhdGUgMCAvVHJhbnMgPDwKCj4+IAogIC9UeXBlIC9QYWdlCj4+CmVuZG9iago2IDAgb2JqCjw8Ci9QYWdlTW9kZSAvVXNlTm9uZSAvUGFnZXMgOCAwIFIgL1R5cGUgL0NhdGFsb2cKPj4KZW5kb2JqCjcgMCBvYmoKPDwKL0F1dGhvciAoXChhbm9ueW1vdXNcKSkgL0NyZWF0aW9uRGF0ZSAoRDoyMDI2MDgyNDEyMTgzMiswMCcwMCcpIC9DcmVhdG9yIChcKHVuc3BlY2lmaWVkXCkpIC9LZXl3b3JkcyAoKSAvTW9kRGF0ZSAoRDoyMDI2MDgyNDEyMTgzMiswMCcwMCcpIC9Qcm9kdWNlciAoUmVwb3J0TGFiIFBERiBMaWJyYXJ5IC0gXChvcGVuc291cmNlXCkpIAogIC9TdWJqZWN0IChcKHVuc3BlY2lmaWVkXCkpIC9UaXRsZSAoQmllbnZlbmlkYSBhbCBBdWxhIFZpcnR1YWwpIC9UcmFwcGVkIC9GYWxzZQo+PgplbmRvYmoKOCAwIG9iago8PAovQ291bnQgMSAvS2lkcyBbIDUgMCBSIF0gL1R5cGUgL1BhZ2VzCj4+CmVuZG9iago5IDAgb2JqCjw8Ci9GaWx0ZXIgWyAvQVNDSUk4NURlY29kZSAvRmxhdGVEZWNvZGUgXSAvTGVuZ3RoIDIwODYKPj4Kc3RyZWFtCkdiISNcPyQiSVMnUmZHUlw7dT1tYHEkVGEhdTtfc2ZVMmRdVCg4VTpDOSE6R1xbKCVebyc/JFQzRCNEXVRrO0Q2TEN1UFI1KiFvTzNxbDZ1Nk1xTXJaWUc8UT8tcW51SmpgIUM9IVdxT1RvMVNyaVNycWwsWTQrVS8uMmY8YUttLiE1TWI+O1RROl5DNXVIUWc+LEZUTVZccygsJ09BQzcjbmcqSStaZFZmalNWRVQwXVMyOmclJDlJbCxyKm1wb0BONjkhXVdqVUphb2YiRUJTTiktbyhAcVRnalIxTFlkXTQ1M2NlMWxKWjBoQD9yaCs1NkM/WEMnPm4lOi1WbzRCPlBlQUolRGRBIkNzKjZuR14tLFc8NV5gSV8xaVo9byg8Y19EVkJkZmAmbisqZ15PRUNyTTRWYnJrNCV0OTxMKy81RFYlOG4+VjYqS2NoajkhUGc9S2FpXV9VQkxsL2onWiUvMiJiOjUsKnVvXyM3YSllWl45bHFaYCkiJmxja2YwX0BtJClIZ2MuKUIyai4xUSwyakY8cmptXUVLQmElcmRbcEUzZDVFPlxvUU1aNkczLzQ6MDE5Y1I7TjEtJCQ5QUBgJDMyK102PkhMcUYnamhlP1ppUGdPUERaOUF1bDZUQ2lbJz8yW09xMSdcMjNWIzZVPl1NbDdxI2gjJFc/Zk9UQmM1Pyg7OGplPVFFQ0VqQmFbTTNZI2tDM182O3IpPHVZQkw6UDZzOC9eVDgzaSY5ZDZHcDtzNDFDczcyIXU6bVNUXjc/Qmo3O3MpKDJxUl1rPikhMisxQHF1XWVHQjlhRkcwckstQzdgPS1ibydLO1tGSGUybEA9YjJWIy82SD8scylIQDlCZ2YldS9XUzlfSnAnZmhuZm9gT2BDK2VcTD46bz1ZWENEN1xacWJhIVRKKUsjPl1GO1E7aSI9V2I7WE4pK0VkYT5UcDQ8J04qZEgmLjZuaU9vLjUoPSVuTyJjMmpecDVVV09NP0xAcW90LzxAPUNZXHArJ3A8JShbKTlddWFyQV5XMjx1US9VMCokOVciWHFoTTFZNlwwNzM1bF8xak9KYmduOjxhUTdBUDU9UWZBNTRjTFg7Kl1FZkFjU0hWJSVwJipTJ2ozT0BNbXJQVClAdGZzWWUpZmFCNnNYN0RVNzgmM0p1NkBpJ2hyZ2dUWHM8LUM9PjMqN25UPF44SDQ6WSltRnFrLjYrMG9oWzp1Zi9uNyxEbGFLOltDbDdbOitaXDtXLnRwZEQ1M080QEYyYGhTNDpnMjV1NytBUkYuUlw4IyYtYWwyRzZkZyolUW1XOTo2aVdLZzRWRHQwPHNmPmFLLj5kXzVCR1xdMjchUFc+YSNQUHRfS1chM1IsPFVzRzdYMlMkRTkmTkxuYT0tbmpWbzk8LGw+bHFBIiI/PWRLaTtxUjtZYUFOJlY8LiVbQnUrUzNoWG80Plo3XSE8IkE+YVtsQm5cJlxuZzpqNFZPPzwlMVZaZTJNPSpQU19CRjQpITozbyMnPzxRaDhXQSlPVWMvOWJkZEl0OT5iLjkpKUVkO21BK2EoPFYqW1N1dE1FMDtELyg9PT5ZK25DODo0YGRkXldAZFEmTm1pQU1YOEddZFlKJEYsO24vQFQlJzheSGwxblsuY1xUYU9ObEEjcyRcSSZpJCQ3T3RIRT9kLl1CYWYuODpxP1hWc0JYOCFER0RsM1cvQU08b1hnQCpISGp0OkhcbCNPcmsnTl1GNE1IN1tfYVUlTE9DaENiTWRIISNYUDVoI1wtIzglbV9MPSVQTSkkYFcqW1heTl5OLkNQQy1qZyFDImxzNU9TTi1WdC4xSlRnS24+TFk7ZUtiKnRXOyMkYTl0PEFPSnMqUEBcUiRKbFkjQ2RrWz9uJWZQLEk9MUdoKF90L1VwczQoTztvPzQudXE9b0RgZ1FnT0U9TT47K25OaCglTDpKQF8/LmJgImBbV2JZMGBYLnFzVCptYkdaY1g3YysqPXBib2AqZkAjYGdtSG5ZWU5SQGMlTGVIcT1AMz1SdDFLN1hJbCJIT0FuN01hYDVQQCo/OE1BbktabU0rWy1GOmloUG8sPVdFPV07UylnS0dtISYjPiZnZjNCJ1plSlg/Mmw1SyplMiExNl1sKTMialByYm1jcGZhUT5GLkYuZGo/NkpVbnBTcl5XN2kmYHFqSGRWT2U+YTMvTmBtYjs+ODFAKk0kU2pGLUhMXkFxKFhmJkxRWj5aUFQ1cVRCSSRMY2MtcHA1cVdqMUwlWCkkKCRsUGYtayNbUzNsTHVJWyJoZFlfaCIva1Q2SSIia1ZkVyZESzNcWVwxMWBSVzhTZXNYUkVkRig9VycqLGZhTDVBJVBJYWQmM1ReayY4NnFHPEZPWSovaldASzBWZk0hPF9xcyksalZjMSNRK1VCZi5eIyMrXllHY3AhYERrJyhpJj0tPmdFKV9sIzZMNzM+ZGlyVDIjSDhySEIhOGpya2A+PG11OW0sMkUqQ1xGbyVTVSJyMXJoLWdmTT0lNWMnWm4uJi1taDY/c0AkamEjLk04TDpnNz9yRUNWJDMvNVpXKSsqMkBzSkkoQylzakNPPGxZJy1pOWs6XzsrRFBVT1giWmFsSGcqXTxpJzBpclktPFlXW0NXaitoUUZAVWgrXjxmNWA9QiNHWTl0PkpsMzxFaHI2KCJaMURaYShsSjMjWFRvKXUhKWo5bTJFZUNXW1guVWheITA+ayM0IXBLZyJecW9ucXNqU1hkWypoc1pmYmdFZGBJIS5lMF46fj5lbmRzdHJlYW0KZW5kb2JqCnhyZWYKMCAxMAowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwNjEgMDAwMDAgbiAKMDAwMDAwMDExMiAwMDAwMCBuIAowMDAwMDAwMjE5IDAwMDAwIG4gCjAwMDAwMDAzMzEgMDAwMDAgbiAKMDAwMDAwMDQxNCAwMDAwMCBuIAowMDAwMDAwNjc0IDAwMDAwIG4gCjAwMDAwMDA3NDIgMDAwMDAgbiAKMDAwMDAwMTAzNSAwMDAwMCBuIAowMDAwMDAxMDk0IDAwMDAwIG4gCnRyYWlsZXIKPDwKL0lEIApbPGU4N2NkMjI1Y2ZmYjcwNzBjYmU3NmZkMjg4NDgzYTMyPjxlODdjZDIyNWNmZmI3MDcwY2JlNzZmZDI4ODQ4M2EzMj5dCiUgUmVwb3J0TGFiIGdlbmVyYXRlZCBQREYgZG9jdW1lbnQgLS0gZGlnZXN0IChvcGVuc291cmNlKQoKL0luZm8gNyAwIFIKL1Jvb3QgNiAwIFIKL1NpemUgMTAKPj4Kc3RhcnR4cmVmCjMyNzEKJSVFT0YK" }],
    quiz: [
      {
        question: "¿Para qué sirve principalmente el Aula Virtual?",
        options: ["Solo para ver vídeos de ocio", "Centralizar protocolos, formación y novedades del equipo", "Únicamente para el departamento comercial", "No tiene ningún uso práctico"],
        correct: 1,
      },
      {
        question: "Si tienes dudas sobre una formación, ¿qué deberías hacer?",
        options: ["No preguntar nunca", "Adivinar la respuesta", "Consultarlo con tu responsable o la persona indicada", "Esperar a que se te olvide"],
        correct: 2,
      },
      {
        question: "¿Con qué frecuencia conviene revisar la sección de Novedades?",
        options: ["Una vez al año", "Nunca", "Solo el primer día de trabajo", "De forma periódica, para estar al día de cambios y avisos"],
        correct: 3,
      },
      {
        question: "¿Qué se espera de ti al completar una formación con test?",
        options: ["Que respondas lo más rápido posible sin ver el contenido", "Que la veas con atención y respondas con honestidad", "Que la ignores si no te interesa", "Nada en particular"],
        correct: 1,
      },
      {
        question: "Si un plazo de formación está a punto de vencer, ¿qué deberías hacer?",
        options: ["Ignorarlo, no pasa nada", "Eliminar la formación", "Completarla cuanto antes o avisar si necesitas más tiempo", "Esperar a que alguien te lo recuerde en persona"],
        correct: 2,
      },
    ],
  },
  {
    id: uid(),
    title: "[Ejemplo] Sistema ABC de ubicaciones: fundamentos",
    category: "especifica",
    description:
      "Formación de ejemplo para equipos de almacén sobre qué es una clasificación ABC de ubicaciones y por qué importa respetarla. Contenido genérico de referencia — sustitúyelo por vuestro protocolo real cuando esté validado.",
    videoUrl: "",
    presentationUrl: "",
    deadline: daysFromNow(14),
    testMode: "interno",
    passPct: 70,
    attachments: [{ name: "Sistema ABC de ubicaciones.pdf", mimeType: "application/pdf", sizeKB: 3.9, data: "data:application/pdf;base64,JVBERi0xLjQKJZOMi54gUmVwb3J0TGFiIEdlbmVyYXRlZCBQREYgZG9jdW1lbnQgKG9wZW5zb3VyY2UpCjEgMCBvYmoKPDwKL0YxIDIgMCBSIC9GMiAzIDAgUiAvRjMgNCAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL0Jhc2VGb250IC9IZWx2ZXRpY2EgL0VuY29kaW5nIC9XaW5BbnNpRW5jb2RpbmcgL05hbWUgL0YxIC9TdWJ0eXBlIC9UeXBlMSAvVHlwZSAvRm9udAo+PgplbmRvYmoKMyAwIG9iago8PAovQmFzZUZvbnQgL0hlbHZldGljYS1Cb2xkIC9FbmNvZGluZyAvV2luQW5zaUVuY29kaW5nIC9OYW1lIC9GMiAvU3VidHlwZSAvVHlwZTEgL1R5cGUgL0ZvbnQKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL0Jhc2VGb250IC9aYXBmRGluZ2JhdHMgL05hbWUgL0YzIC9TdWJ0eXBlIC9UeXBlMSAvVHlwZSAvRm9udAo+PgplbmRvYmoKNSAwIG9iago8PAovQ29udGVudHMgOSAwIFIgL01lZGlhQm94IFsgMCAwIDU5NS4yNzU2IDg0MS44ODk4IF0gL1BhcmVudCA4IDAgUiAvUmVzb3VyY2VzIDw8Ci9FeHRHU3RhdGUgPDwKL2dSTHMwIDw8Ci9jYSAuMTIKPj4gL2dSTHMxIDw8Ci9jYSAxCj4+Cj4+IC9Gb250IDEgMCBSIC9Qcm9jU2V0IFsgL1BERiAvVGV4dCAvSW1hZ2VCIC9JbWFnZUMgL0ltYWdlSSBdCj4+IC9Sb3RhdGUgMCAvVHJhbnMgPDwKCj4+IAogIC9UeXBlIC9QYWdlCj4+CmVuZG9iago2IDAgb2JqCjw8Ci9QYWdlTW9kZSAvVXNlTm9uZSAvUGFnZXMgOCAwIFIgL1R5cGUgL0NhdGFsb2cKPj4KZW5kb2JqCjcgMCBvYmoKPDwKL0F1dGhvciAoXChhbm9ueW1vdXNcKSkgL0NyZWF0aW9uRGF0ZSAoRDoyMDI2MDgyNDEyMTgzMiswMCcwMCcpIC9DcmVhdG9yIChcKHVuc3BlY2lmaWVkXCkpIC9LZXl3b3JkcyAoKSAvTW9kRGF0ZSAoRDoyMDI2MDgyNDEyMTgzMiswMCcwMCcpIC9Qcm9kdWNlciAoUmVwb3J0TGFiIFBERiBMaWJyYXJ5IC0gXChvcGVuc291cmNlXCkpIAogIC9TdWJqZWN0IChcKHVuc3BlY2lmaWVkXCkpIC9UaXRsZSAoU2lzdGVtYSBBQkMgZGUgdWJpY2FjaW9uZXM6IGZ1bmRhbWVudG9zKSAvVHJhcHBlZCAvRmFsc2UKPj4KZW5kb2JqCjggMCBvYmoKPDwKL0NvdW50IDEgL0tpZHMgWyA1IDAgUiBdIC9UeXBlIC9QYWdlcwo+PgplbmRvYmoKOSAwIG9iago8PAovRmlsdGVyIFsgL0FTQ0lJODVEZWNvZGUgL0ZsYXRlRGVjb2RlIF0gL0xlbmd0aCAyMzg5Cj4+CnN0cmVhbQpHYiEjXDlsbyZJJkFAc0JtJWxMVWEnbmQ8MHQwLDo0Nys6THEvQ11PIlg1Ki0vZF1sSVdFL2lmSTEmcHNqaUZpbXB1KFxwWjpLP29oWDgrK01oJDNRIlJeMionNCJxbGNiQll1S1FPVnIrU0s5VUg6cjFaY0wvdWosWW44YjYhYis1QnE0UVRtSjlMZG5mZ109YDwsTGw0UnA5PjhMWXI5QyVdckMoQyw2TkBxKCtQTidCJkE6TzFzMD5OUjZFPnNAXDFWbm0lSVAnVWdgam9ML0QwOGU0PFY1cCcxaHQ+U3UpT1NpbUMiaFIkWS88KWs9KylDWTA0aGIlPCdTZ10vUkE8c0lrPzAvalU0Ojg+ak0/MidGL0VNIlUyNUgrKXAvb11KTFVGYUtqL2NVKktxPk81Z2cnLXFxOSEjU21IU15tPicwK0gpbEphWzk1a1IpOlFmU3A/NU5iKDNHSz07ZkFCcWsnRidiNzklRD47dXNaVUpgLmNWMTFBMig1MmdhT1hBYT5aRkdwWEE+S1chTk5qYnRISVxEOW1XU1pvX1pLbjgnMHNTQzcjTydXNitUVFNbUWltZmklbidkSG9zbSYmJ1VFY2pBVWFyKyJEQFVIMl5DQ1NaRSIuXHBSNUtVamBXJiRZP1xdP2RidCtWNVU2WTlSR15IaiMyVmpnbnQpXGYjYWsoNWdTUEw1R0M6WHAuZl9YLlQqSE5VK29sKXByIjxgVUM1YmosJElWa1hmLGNXNi8jL2lcIjJnXC9JIzsrPU9XXFQ8Ly1YVy5YOFgoKHVAalFuVDFNOklwLXE4U21yIkMmQGpUbW1MNCI7V0RYJ2VfVE0palM/Uj5XSiVdSi5KJjlTIlQiKlY2QklaRU5XJ0RnV3FQNDlPI1o2N2RUSio2NlduJ2NdYkAwWzBYQC8hPT4iTDVlVSUjZ0w+J0YkKiVGbm9MKnQlcF1aVmUsTmRHYEtCST4iLV5fQWQ0RDBibTtgbk9mWlRWMUUramVvJGAyN0dcRCY0N2EqQVtIOmdyTV1wWF9LLFBwMF9fSSg8P0sxNS1HV1haQSg7JyleTUdBImYuOCdUclc4X2BsZixqbWlXTFg0KFopKiw9WVxaWFo+Lk1BLVpCMThPP3JwNHEuTWo/ZjxXLSonWExJKCFRdW1UJFIxX3U7QDNpLWFYYiQ5U18zWDBQUDZLXXJUJE10L1ktaTtXO1pLW3AsYEZuJk89XSopMTAwVSdmP1YjTHBSUSYoNHI+KFZiV2pfKUtfcnJBPVg6PEZMZD83Wl9PWWxmQGJjT21AZkYyQ1UlO0BfXW5gPEUiLVw2W3AzXEhsOjNjRGg+WTkwKHFqLSVKQj9wOjZDK2FLWCwtNm0uPXV0WS8/a1wsLSprL0YvZWZyKzBuVHA/XDFVKEtySTQqWzZPK1VgXTs/Py9MQkAmXS5HMF4zU1o9YmhAWXEhL2dURjBnKDNQXU5HYkkqVjVTVXRwSTRZclVAIyg3bEVZOTFmMS47ZjFYSGZlIyE1OkFTSThlMTQ2N1ovXmMuc1dZNGEnLD09IUEuQDsxWkJLVUMpWUdNZkcnOkoiQTgyNU0jNWtobl8mOCJlX1MjVDI5PDFFb1pkWGJmOE51Q2MjdTlnO0BNc2llSjByNk5gRlJGNSMxI2AuQUdjQ0dfIyVkIy8ocUJsKUwkT04kRUtnIjNEaiY3KEVuNzdPdVQ3NyhDcjRQbWdWNVdyJmVwOXNtb1hOay0xajZnNUJEU15NXiQhc1w2aUxYSV1uL0ApV145TlpvbmotQ1lsWEdpNkk0ZFksJkAva2VbPzRJTT88UEstMmQpQWlQTEojPDdGZklwPkZlIitpMCFULUhRcyIuOjVZNztyQzwrYTNnWHVXSmFOQCEyNio3cWQ0RlJBO1tPNEk+bGxRUy1LY2ZEImpDQD9NakApWS1hJWxJMV1gLl03b2tFNm4yP0ApU1NFPDMlb0hOLyI5WU9fWjJgVGEzXT5pJlomR0Q7MkdkMDVrU3RaMUxxPiEqa1pDVFdgYz9aOjlQXCIyTWJBTSUwRjQsMj47WyRVMm1tUkteNENITmJsVWhxaTZgXF5iRUZWSkFuLDo3RDBNTWUrYG4+YFgzSVdEOlEuZERUalE8QnJyV0JwRSYsUDVFRGVFQ0JjcCdWaWxjQjgoPG1gO2hfT2onZSVqKFZzXENsWmtRWyxmMk1SJy1ZOlRvLD0pPlwpJCdYdTpGM3V1RCE8Iz9DUytPZUIrMyF1RlkrcnRjPVNAbC9raTJxUURgKGxVLGRCSShfaEQwNXROLSkkXSZxXE9YXlJgWzQzaTdjPixOKkgwYy5falMnVGc6XFs8VHQzVGdYJS1dR09UW2EzST8nQ3UsdUVOPjgqRWQ5MkZMOWwxXSlyaDhAcGc6SXBoJyIiU3RhT2AsXiQ7QHJhZ1FAdSRbNTVnamFHJUVxYTwzbClMPV8lKzZ0ZEcrYU9HMD0hbEFlT2JoT1hVaihgNyhPP2BZTmsiRDYlUG4zTDVFOTdIYCdeIWYsTCI5aSgxOUlnT1RrSTVoQlNWSWs2PGJKVS9rX2RpTCdcQi9EYmZYcU8lL2g1XipXbD1bOVFfNUYzbTNcJGdxUyYjcW5qQVJRXDZFSjhXa2RgOVBeayk4ZGE7cVc5JXQja09XKlQjbkhgciF0TyROQDtmcERXTiUtSTprKkQnJSIjQGwlMVtQNidcSyY4aXVGclNITj5iNHUzMjZEXC4wNiFJVmopQiJCVERxYmtXamA+anVCa0EsRHNeMEtIYVtdJ15cYEVlV3Q+Q1wiPyRfNz9xcyY7XjooZEFVdXJccj8vbkcpXCpDSyd1XSQhTWxfalkia25QJT8wMiMlK09aTywvcjxPOSpeP1xwJ21HbUg7KERAXm8iQyJePXNncUZCMC1tKW9TYCtmLzkzPj9KLkEjUC1bYzRKaCMyPVtkaz5tOVFjNjtUQmhoOktKJUFIQDo0IUxeNEwlYFVAbGZdYUhPRy9lInM8Zk1lLEVNVl9ZNmRScj5hWXRcVVJUaDQ8PGU7X3JWImlGUTZdbGpPXV1ANDgqLjlZYDJsVnNiOTIzMHJvWyIyXUVIU2Quc2RQWFBdbyF1aTFQZyZqKkhFUyg1YFpTJl4wPiJEKFs7JUdTInA8LF82Wm5DOkxiLCtxI0tUJyU8V34+ZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgMTAKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDYxIDAwMDAwIG4gCjAwMDAwMDAxMTIgMDAwMDAgbiAKMDAwMDAwMDIxOSAwMDAwMCBuIAowMDAwMDAwMzMxIDAwMDAwIG4gCjAwMDAwMDA0MTQgMDAwMDAgbiAKMDAwMDAwMDY3NCAwMDAwMCBuIAowMDAwMDAwNzQyIDAwMDAwIG4gCjAwMDAwMDEwNDggMDAwMDAgbiAKMDAwMDAwMTEwNyAwMDAwMCBuIAp0cmFpbGVyCjw8Ci9JRCAKWzxhYmY5NTVhNDgxM2MyZDFlNjhjMzhmNjA4MTlmYjNmOD48YWJmOTU1YTQ4MTNjMmQxZTY4YzM4ZjYwODE5ZmIzZjg+XQolIFJlcG9ydExhYiBnZW5lcmF0ZWQgUERGIGRvY3VtZW50IC0tIGRpZ2VzdCAob3BlbnNvdXJjZSkKCi9JbmZvIDcgMCBSCi9Sb290IDYgMCBSCi9TaXplIDEwCj4+CnN0YXJ0eHJlZgozNTg3CiUlRU9GCg==" }],
    quiz: [
      {
        question: "En una clasificación ABC de ubicaciones, ¿qué suelen representar los artículos tipo A?",
        options: ["Los que nunca se mueven", "Los que tienen mayor rotación o importancia y deben estar más accesibles", "Los que ocupan más espacio físico", "Los que llegan más tarde al almacén"],
        correct: 1,
      },
      {
        question: "¿Cuál es uno de los objetivos principales de reorganizar ubicaciones según su rotación?",
        options: ["Aumentar la distancia que recorren los operarios", "Complicar la localización de productos", "Reducir los tiempos de picking y desplazamiento", "Ninguno, es solo un cambio estético"],
        correct: 2,
      },
      {
        question: "Si detectas una ubicación física que no coincide con lo que indica el sistema, ¿qué deberías hacer?",
        options: ["Cambiar el producto de sitio sin avisar a nadie", "Ignorarla", "Esperar a la próxima auditoría anual", "Reportar la discrepancia siguiendo el protocolo del equipo"],
        correct: 3,
      },
      {
        question: "¿Por qué es importante respetar la ubicación asignada a cada referencia?",
        options: ["No es importante", "Porque garantiza que el sistema y la realidad física coincidan, evitando errores", "Solo importa para el departamento de compras", "Porque así el almacén se ve más ordenado, sin más motivo"],
        correct: 1,
      },
      {
        question: "¿Qué papel tiene el picking en la productividad del almacén?",
        options: ["No influye en la productividad", "Solo importa en campañas puntuales", "Es una tarea secundaria sin relevancia", "Es una de las tareas que más tiempo consume, por lo que optimizarla tiene alto impacto"],
        correct: 3,
      },
      {
        question: "¿Quién debería poder modificar físicamente una ubicación sin pasar por el proceso establecido?",
        options: ["Cualquiera, en cualquier momento", "Nadie — los cambios deben seguir el protocolo y quedar registrados", "Solo los nuevos empleados", "Solo los clientes"],
        correct: 1,
      },
    ],
  },
  {
    id: uid(),
    title: "Inteligencia Artificial en el trabajo: guía general",
    category: "ia",
    description:
      "Formación completa e introductoria sobre qué es la Inteligencia Artificial, cómo se usa ya en el día a día laboral, qué asistentes existen (ChatGPT, Claude, Copilot...) y qué buenas prácticas de seguridad y sentido crítico hay que aplicar al usarla en el trabajo. Pensada para cualquier persona del equipo, sin conocimientos técnicos previos.",
    videoUrl: "https://www.youtube.com/watch?v=-Nfcj0F7b-Q",
    presentationUrl: "",
    deadline: daysFromNow(21),
    testMode: "interno",
    passPct: 75,
    attachments: [{ name: "Inteligencia Artificial en el trabajo - guía general.pdf", mimeType: "application/pdf", sizeKB: 6.1, data: "data:application/pdf;base64,JVBERi0xLjQKJZOMi54gUmVwb3J0TGFiIEdlbmVyYXRlZCBQREYgZG9jdW1lbnQgKG9wZW5zb3VyY2UpCjEgMCBvYmoKPDwKL0YxIDIgMCBSIC9GMiAzIDAgUiAvRjMgNCAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL0Jhc2VGb250IC9IZWx2ZXRpY2EgL0VuY29kaW5nIC9XaW5BbnNpRW5jb2RpbmcgL05hbWUgL0YxIC9TdWJ0eXBlIC9UeXBlMSAvVHlwZSAvRm9udAo+PgplbmRvYmoKMyAwIG9iago8PAovQmFzZUZvbnQgL0hlbHZldGljYS1Cb2xkIC9FbmNvZGluZyAvV2luQW5zaUVuY29kaW5nIC9OYW1lIC9GMiAvU3VidHlwZSAvVHlwZTEgL1R5cGUgL0ZvbnQKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL0Jhc2VGb250IC9aYXBmRGluZ2JhdHMgL05hbWUgL0YzIC9TdWJ0eXBlIC9UeXBlMSAvVHlwZSAvRm9udAo+PgplbmRvYmoKNSAwIG9iago8PAovQ29udGVudHMgMTAgMCBSIC9NZWRpYUJveCBbIDAgMCA1OTUuMjc1NiA4NDEuODg5OCBdIC9QYXJlbnQgOSAwIFIgL1Jlc291cmNlcyA8PAovRXh0R1N0YXRlIDw8Ci9nUkxzMCA8PAovY2EgLjEyCj4+IC9nUkxzMSA8PAovY2EgMQo+Pgo+PiAvRm9udCAxIDAgUiAvUHJvY1NldCBbIC9QREYgL1RleHQgL0ltYWdlQiAvSW1hZ2VDIC9JbWFnZUkgXQo+PiAvUm90YXRlIDAgL1RyYW5zIDw8Cgo+PiAKICAvVHlwZSAvUGFnZQo+PgplbmRvYmoKNiAwIG9iago8PAovQ29udGVudHMgMTEgMCBSIC9NZWRpYUJveCBbIDAgMCA1OTUuMjc1NiA4NDEuODg5OCBdIC9QYXJlbnQgOSAwIFIgL1Jlc291cmNlcyA8PAovRm9udCAxIDAgUiAvUHJvY1NldCBbIC9QREYgL1RleHQgL0ltYWdlQiAvSW1hZ2VDIC9JbWFnZUkgXQo+PiAvUm90YXRlIDAgL1RyYW5zIDw8Cgo+PiAKICAvVHlwZSAvUGFnZQo+PgplbmRvYmoKNyAwIG9iago8PAovUGFnZU1vZGUgL1VzZU5vbmUgL1BhZ2VzIDkgMCBSIC9UeXBlIC9DYXRhbG9nCj4+CmVuZG9iago4IDAgb2JqCjw8Ci9BdXRob3IgKFwoYW5vbnltb3VzXCkpIC9DcmVhdGlvbkRhdGUgKEQ6MjAyNjA4MjQxMjE4MzIrMDAnMDAnKSAvQ3JlYXRvciAoXCh1bnNwZWNpZmllZFwpKSAvS2V5d29yZHMgKCkgL01vZERhdGUgKEQ6MjAyNjA4MjQxMjE4MzIrMDAnMDAnKSAvUHJvZHVjZXIgKFJlcG9ydExhYiBQREYgTGlicmFyeSAtIFwob3BlbnNvdXJjZVwpKSAKICAvU3ViamVjdCAoXCh1bnNwZWNpZmllZFwpKSAvVGl0bGUgKEludGVsaWdlbmNpYSBBcnRpZmljaWFsIGVuIGVsIHRyYWJham8pIC9UcmFwcGVkIC9GYWxzZQo+PgplbmRvYmoKOSAwIG9iago8PAovQ291bnQgMiAvS2lkcyBbIDUgMCBSIDYgMCBSIF0gL1R5cGUgL1BhZ2VzCj4+CmVuZG9iagoxMCAwIG9iago8PAovRmlsdGVyIFsgL0FTQ0lJODVEZWNvZGUgL0ZsYXRlRGVjb2RlIF0gL0xlbmd0aCAyNjY1Cj4+CnN0cmVhbQpHYiEjXWJCRFcwJyZEayhxS1BIbGE9bk5OR1pNc0hkNCElbCs0NFc8OWFiZCJYVD9kRiIvJTVxclM2WkI1Wi9kUC5hYyxSWjpMV3FbcitAP1dsMTxkSikoI1UuYFFxT0E4Y3RaTiFKXz9SZG5JV2ZdPEEzYk42azVNJi9bZVQ0Y0MuNEFEUGxxRD9CWilOMXBVcDlHK2VFPzlIbSlDSShFN15EP1A6OnVER00zIT82NSNWNnExLV9JZF9lSChkZHJHMiYoPmVUXzxoK0QrKm9yZ3BSMjg9YVBkJj5nYyRvLUVARF9cXXA5U1hwJ3E1RyJiMEtpXVllUUZlSDtWQ2dRVCs6JVZ1KGk6Uj9xUThZZS9NYkdvNihKV1doRWViPEE7T0VFczFjKHQoODFpXDZCWCdfMCFxNUtqNGNQNlEja2oiaDI5TGxaclFOITZJJkYuUkNGInFRXyUwWyc1OkgsKTEuRjc8I3FlQj0iLyM+OyRgKS9YcU9qUSg7YjgqSVtINlUkI21CRl9KYjMrSTA2bWNAV1pYSFEpVDk+LWpORUBmaEcsQihFPms2JWUyKWNsWi4jZFlRKk90NnBcSG0xPGdIcy5DLUchOSY9NytiJXBeYURcVENQVDZTXHMmc29iLjpFJFNYRTVZLnNyazhYSTFWQkI+ZyhGZDV1KnVPIXNNLCZOc20kKWI/WUliZHJRbyZGPGVxcFFkSztAKyMmIzRGaHIuaEppanMvOUssRDstJjhUXmkublhUWlhdKUFbUSwjOzg9a1JmYTAiPzI6PG0jPj1YVTA9cXVXSDddciRHU3NDa0pHR0k6ZFkuSVNrNy5cYnRQWldjK1A9MXFfcDY8KHBCTT43O2g2Tj1IUURKSlshIzRTQT0rJU1IWjM6cUg1VF4ralYjMzVIR2xBVWA9Xk1pcTJnc0xyWWZwOyRHLVpeJlg4NiJoTUInPC4iXzxeO0I0TlMwcHQ+dXVpMSRIP2hoPkwwXnQ0bi5wMlpDODxiIUc/TEYhVCkwT2gsZENNKE0vPyZLJHNfZUgwYyciKjBZNDNNcG5aJzUrOmwtbUhtJHMnZjImIk8oPkMqWigwIWc9UE0pLW1APkFAIilFbj1oUyNAOztKbVlePl5JYm8uU01PcypnRDE7WTw0QmxXaHFJREtTTStgKFlxPkRUJiNRa0tjMlsqVFU+LSZGJllCWDZvXVBzMzNScjs9Tk1sK0xVOGA5UnVJWVZkXGdqSnJWVSZYMGs9VTo7I0clcSg5aW5HMjJccWc2VFBJO2QxRVJCUkshYk1dN1JLQGYlPnB0WjcvbkQuK0dtb20tYVdnJ0NzcUBbTlVqO0teIihsWnVSSSJHWXNEI3JvMmtuS1VeOiw0JmpfaF0pJjpmY1c3IVxZSDo0U0QnRjdCUGRMbDpQSkZEK3FSZCZgQ2ktPFZTVFZgRFdvZk1GK2JVRUo4NmtSLChCbFlsWjMtcC5DZTxiZVpzVyIqaydOPk46XHNZQT9hXVpPI2s/X3VuIiZeUnUuTEckOCQuLl9hJVVrKTwlbGJwY28/XHNQKzcxXTM1XztvSSxPJmJadDJuQVhiW0NtOlk3YDM+aWlLJFojOlE2aFJ0PEZNST9MVzxgZzBWdWtiNGU7a2ZnT25HYGgvOl04Q3U1ckw1Tz9YYyYmdCkvMz4uS2A5cC5XTEQlby1fPj4wQltnRUMuTCVqX1ZqYj9fIjsrKS1bbEdASCZSYEJ1JTIjK05NXjpEQCNPaCtgSlRlMEJYKzNqSjNzQ0RZbEdaLG03bjYnTCRQQC5zJlNrZnVDdSw1UWUqQTo4VlVKLEtNS0BHUEhHRCJJdSc4NmRDV2pvJycqaC5lKj1adTN0cCFFZWIscCghclpFMHM4Rl9aXS8vWmFzP1loNUs9KTw1WmtWOm44ZVMrS0krLEtXTFJwRk89MUAhdGYuaDtCTm1vcUA0SiZQZSR0LGhjNCosWDA5LF9fJHMkakw0RXBzZGA2LS5dQ1BAMF4rNlZqKylqKzZOYyYnK1dWNGMqJ0ciN2E7YFA3O1peW1JbajpyJCtjRiR1RW5qdU8uVU82cFFaUT44cmA4KVJJK0VbI19EXlZtUWxvNGpXWXI0U3MsJSZWLSI1KTVJZ1QtOz1kOjo7dFpwUW5XXTxEMThNLUVtZ0NrUUssMjFoYEchJFBjZCEpTVZUIWw8RmZUI0xkanBzb0c6Z10ual9gdWVgVypfJFBDUFBbJSwrJkQ9QnByTDZyOUhcN0csZVYidWZiaCRoIVhZPzBUOj1fbkA1PEJQIV9QZkJVdHVxY05Xa2s1VF0rMm09YCM+O2h0Q0w/UW1SLlsqTTlxMGMhN3QqXXJSN1dEJDluSy1TUyJiVG4pP0ExYVRfLUReUTZxPU5fcSxqY0YrPihpVD1qUGBDTkQ2Z2ZbK1QoOEptVyFfZWAnai41QWMvZ3RwK1tYaV42SCtOWld0ZjQlMmIrSkNxYGJwO15BaCpMSTVGU29nWmxsOkx1OEdaTjlRSjMpb25oOFheYygnKyhVYS5RUz9ETFFxQVVFSmZmb15EKlwsX10kJUBHZGdZPik2ZTRiOSUvS0wmRV0ySC1MODYqa18rPDhdb1ptVkNVTVw4Z2tTTEosK2xmZ0JQbCwtcyI+YSROS2t0Iio6RUQiKjxsP2ArT1ddVGhtJGRkV0RmJ1BDWHFdUiVDXEVdRWduIkUxOC1UYyQmZXVJUWstRFtlbWlJIyRaZ0cmMzpMRTFCbitmNmBxUztdRitPSyxTS0g9KHBZMT01Lz06XVZWMmVoJEtTJER1V1g5RG5XMzssIjE6cklaYWFMZkdZMDVLPXQ9dDsiVSg+YztINzVvP24odEIpT00sQGxXITcsPSEtdTJpNVBnXTUoWWFAJHJLUCdFZTxBcnJ0JFhxZDJqajUmcTc4NUpsZCpcdVxvVyoyPWYtPUNTLl5ZWzFEPXUsT1x1KGhFVlFrMHRmLz8mQ0h1cGA6SDZMSixDL2w9T0xRaUcoIlNpcF1HYFYnJWdEcFF1IjdDcnVwbmNjRlojLkQqXy5CMilUOS9Fa1o8MCtRW0haYmUjKD4kak5RbjsqUHRhQT9yPmckUlBVNCdaal1aVDFNLF8vYm9dMkg1X1IyMkQ7JypfO0lrZDc8W0pgb1A+QVphJ21FZSFBbEFuZUdbXGkxKldfRXFsJzppOzdmM2VZVV0tN1J1O1hjWSpEVUFpZGZYMiw3UCw8Om5IX0h1Uyd0P1EkY3E5ZGxkUGIja24hSV5CbF9UOyZuNEJyO0oyX2gzRDsuR0dXSStZZ3E7ayEwWlhySCNxdWY2cHFrTTwnQmApWWc8JTZTRFMwajtIWmdpNnNqcF9rMUExc1hCTWxNPzFkN3NYOydqcCM3WD5uN0xcJyQ3ImRsSzAyTHFOcyNZaGIwXyRlXEEyRkpwO01SSTk9WkcyN1UqayleW1huPXE8YT1tLjE1WjJTPi5XUHQtSkxcUmQ5MC0sdGJhT1hXQXFiYVknbnI8LCxRW0k4cFhWaFlZRVEmXFRxKjJlSyZFV34+ZW5kc3RyZWFtCmVuZG9iagoxMSAwIG9iago8PAovRmlsdGVyIFsgL0FTQ0lJODVEZWNvZGUgL0ZsYXRlRGVjb2RlIF0gL0xlbmd0aCAxNjAwCj4+CnN0cmVhbQpHYiEjWzlvbiRlJkFAUDkpISdgXFkra0JHaEBkMV0kVCg8K1wzOVhTOT0xI244UTg2I1MpJUgvMmpFW11uWVU6PCsrYVlzTz1aOEZEci8tUE4kdVZPalQhZ1BkSF9PXEhrVD9rZHFWTlEpUGpiOk5JRzNpSSgwS2cxXmdASUpnYCw+Wm9EPThtXFwlYTE8Ry1SYDokaW8iYF1bZFBgcTY6STtvcHI7M2NvPVIsQ20zKCFGSWEoWEJXLTYscVlabzNRWVtjIWIxL09CNkU6Oy1YO3NSXHIwSjNhMDE9bFFoUGAsSkRbOl44NXRCKFxHa1hLKVNlX0ZKPTFZWCNqTHVxIyI/KSksdC9hVDc2K14zXz8qO2wzNS1zYlBqY0RxZlIwSGEmIUlhTzxuJDpUYCxta1VKNCpKR2FrJTxAWXRlWkMhS2o2aFRNSEdXWSNcJzpwJ1ZzQzFMWyVkSU8mcjMxYy1VOjYkUVVuaFE3ZEpzOWNcMjlzWTg0SE9COiJQIXMwLGFqX1NHPjQoUDgvZ1BhKGI4Mk4+QVpEdS5xIm4+LWMrYjEhbTdlZk4zbSc5W3JuYF41PiJUJmhzIyJpPlQ3Q2EtLyRiTDFlKVRiTVFsdWIoM29CJD0jQCJCLDJUXSwoKUBiUk4jOCwmPj4pOHJeIjtubSpVY0chVkhgUjU4QFZNOW9kQ19RbyZKKiJQOldjPlhRKEVfPGNZLyJkQjg3IWBGLz0tMWE4VS1uQWAuaCxcXyVoN1NWbS5eVHRla1VkajhDIWcmcXNdcCFVclJRbF4nKWdvPU9IJ01XbytnN0knIVI1Iz5UXzdNZzY0Jy5zTD5gNkVaREdzKU5PW0ZSNnJxNXJPZSQ9V0JlYmFkI048ZXA3OEQ1U1JYazAkVV1wXUI0QG8jZmQmVUFab1QpczVkR3FDaWtXb0E2YUk2UG9XWXRrMVkmYnVaWyxEcHVeXVFxVS9qVkhpWUVfVipUI1tKbz9AY29uSC5rIWdMczw9UGRuUChVSywuXkM8XEttLSlTYmtOX2w5PW5ULjddMk1LXC9KNkwoKkVUcjNMYSVvKlQxUCFrTjM+KT1UaE0+alpVPzhecSs6TzdCOWtqa2cjV1JtYmc6WTg7UUxyc0taT0lkaWgoP0dQW09VJTBLPTtoQCJFMVEyVWU7XlBwPE90W0lXWiplY29dOTt0ZkUlNCgiLFQ8LjVmPComRmBwYFpIXVdTMGxKQERYbmxnRTRVMSY7SzcnbEpRaF5kaCQjNzNEYEI4dTgyPFFtdFYnMT4maDpAZEsjQ19WdCZUOyNsVD9qUUpLTGkuJUFQMjJuKTpjSHVrN10sPVwrTjpEZllHUSsoY2lWWUFEcV9UO11xWzNBMCokKSI/b0FIU0okVEY/ZmVjcVA8JkZpRVM/LSlpI01iQF5UNmwsNUlqMVAoLzM6O042VlQ2N2VcKnJDcy42SlglcjNEJlUkV1NwM1UrXDRpSDk+TlNwTXU/OkkvNiRUJixJXGwxSyoxYC9VcFkoR0NrQG9iX0pJU2dYRl5qY0FzX1RjXjE2Smo5KyszbF4uWWA7Y3JXQUVzRTJRMlQhYjQ4RXQxKz5kLVAmSWYicyklRzs+bDZ1P1lJPW1RXFRlV1ZkZSFRTiIrZFdYVlVacTozQDRxMmdQakM/QVRFXSsxSVU9KzcqNy1XZl5jUjBPMWsoU2BWZ08zSUtYQytkVlVBdWZqbEdKXGRlYjlKQ1AzSjYiT2YuKGM3Z2lSMkcuO2BZL1tHUSM0NixAa0dcR2pHPmYjR29fZVVtWVNGOzVccT9DV1xiNmZUXTciQl9xMDdhMyIsUFF1KnMqJGBnaXBpYkkhdD1WV2lnSkRxQjY5YTE1UixeczdnKlFYZipPdSIhVW9fXVgvMHM9TnRwQFMhMUY9Q09hQGguamovZkA2O1AqZjpKQTFKOjlNKyRLaU1FSmJMLiwiJjY4KypSLyJYTDQ4SUJnSisxREAnZE5hJ207QC1DaF4rZXA4IShKaVdkNjhWZkItMlFkREByRmZzaGloVy4xUEJzL1hHXXBMRCM8LHU7KG5jOTFNJVZpdDZuIiI/ay1JN11IQnJhSzdpc0BKJS9FZFpGa0c0Yz9JZllCUTVdbX4+ZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgMTIKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDYxIDAwMDAwIG4gCjAwMDAwMDAxMTIgMDAwMDAgbiAKMDAwMDAwMDIxOSAwMDAwMCBuIAowMDAwMDAwMzMxIDAwMDAwIG4gCjAwMDAwMDA0MTQgMDAwMDAgbiAKMDAwMDAwMDY3NSAwMDAwMCBuIAowMDAwMDAwODc5IDAwMDAwIG4gCjAwMDAwMDA5NDcgMDAwMDAgbiAKMDAwMDAwMTI1MSAwMDAwMCBuIAowMDAwMDAxMzE2IDAwMDAwIG4gCjAwMDAwMDQwNzMgMDAwMDAgbiAKdHJhaWxlcgo8PAovSUQgCls8MmNlMzgwZTVjMTAzNjM0MWUwNmRiODUzNTZiNTRhZjY+PDJjZTM4MGU1YzEwMzYzNDFlMDZkYjg1MzU2YjU0YWY2Pl0KJSBSZXBvcnRMYWIgZ2VuZXJhdGVkIFBERiBkb2N1bWVudCAtLSBkaWdlc3QgKG9wZW5zb3VyY2UpCgovSW5mbyA4IDAgUgovUm9vdCA3IDAgUgovU2l6ZSAxMgo+PgpzdGFydHhyZWYKNTc2NQolJUVPRgo=" }],
    quiz: [
      {
        question: "De forma sencilla, ¿qué es la Inteligencia Artificial (IA)?",
        options: [
          "Un robot físico que sustituye a las personas",
          "Sistemas informáticos capaces de realizar tareas que normalmente requieren razonamiento humano, como entender texto o reconocer patrones",
          "Un programa que solo sirve para generar imágenes",
          "Un tipo de virus informático",
        ],
        correct: 1,
      },
      {
        question: "¿Cuál de estas es un asistente de IA conversacional (tipo 'chat')?",
        options: ["Excel", "Windows Explorer", "ChatGPT o Claude", "Adobe Acrobat Reader"],
        correct: 2,
      },
      {
        question: "La IA generativa a veces inventa información que suena convincente pero es falsa. ¿Cómo se llama este fenómeno?",
        options: ["Spam", "Alucinación", "Phishing", "Un bug de red"],
        correct: 1,
      },
      {
        question: "Por eso, ¿qué deberías hacer siempre con información importante que te da un asistente de IA?",
        options: ["Darla por cierta sin comprobar nada", "Ignorarla siempre", "Verificarla antes de usarla para algo importante, sobre todo datos y cifras", "Compartirla inmediatamente sin revisar"],
        correct: 2,
      },
      {
        question: "¿Es buena idea pegar datos confidenciales de la empresa o de clientes en una herramienta de IA pública y gratuita?",
        options: ["Sí, siempre, no hay ningún riesgo", "Solo los fines de semana", "No, salvo que la empresa lo autorice explícitamente con una herramienta aprobada", "Solo si el archivo es pequeño"],
        correct: 2,
      },
      {
        question: "¿Para qué tipo de tareas suele ser especialmente útil un asistente de IA en el trabajo?",
        options: [
          "Tomar decisiones legales vinculantes sin supervisión",
          "Sustituir por completo el criterio profesional en decisiones críticas",
          "Resumir textos largos, redactar borradores o ayudar a organizar ideas",
          "Ninguna, no tiene aplicaciones prácticas",
        ],
        correct: 2,
      },
      {
        question: "¿Qué significa que la IA sea una herramienta de 'aumento' y no de sustitución total?",
        options: [
          "Que aumenta el precio de las herramientas de oficina",
          "Que reemplaza completamente a la persona en su puesto",
          "Que solo funciona los días laborables",
          "Que ayuda y potencia el trabajo de las personas, sin eliminar la necesidad de su criterio y supervisión",
        ],
        correct: 3,
      },
      {
        question: "¿Qué es un 'prompt' cuando trabajas con un asistente de IA?",
        options: ["Un tipo de virus", "La instrucción o pregunta que le escribes para pedirle algo", "El nombre técnico del ordenador", "Un archivo adjunto obligatorio"],
        correct: 1,
      },
      {
        question: "Si dos personas usan el mismo asistente con el mismo prompt, ¿por qué pueden obtener respuestas algo distintas?",
        options: [
          "Porque depende del color de la pantalla",
          "Porque hay una única respuesta correcta programada de antemano",
          "Porque es imposible, siempre da la respuesta exacta",
          "Porque estos modelos no siempre generan una respuesta idéntica cada vez, aunque la pregunta sea la misma",
        ],
        correct: 3,
      },
      {
        question: "¿Cuál de estas es una buena práctica al usar IA en el trabajo?",
        options: [
          "Publicar cualquier respuesta de la IA sin revisarla",
          "Revisar críticamente el resultado antes de usarlo, igual que revisarías el trabajo de un compañero nuevo",
          "Usarla para decisiones sobre personas sin ninguna supervisión humana",
          "Compartir contraseñas de la empresa con el asistente para que 'te conozca mejor'",
        ],
        correct: 1,
      },
    ],
  },
  {
    id: uid(),
    title: "Buenas prácticas para trabajar con asistentes de IA",
    category: "ia",
    description:
      "Segunda formación de ejemplo sobre IA, más práctica: cómo escribir mejores instrucciones (prompts), cuándo conviene revisar o pedir ajustes, y qué tareas nunca conviene delegar sin supervisión. Complementa a la guía general.",
    videoUrl: "",
    presentationUrl: "",
    deadline: "",
    testMode: "interno",
    passPct: 70,
    attachments: [{ name: "Buenas prácticas con asistentes de IA.pdf", mimeType: "application/pdf", sizeKB: 4.9, data: "data:application/pdf;base64,JVBERi0xLjQKJZOMi54gUmVwb3J0TGFiIEdlbmVyYXRlZCBQREYgZG9jdW1lbnQgKG9wZW5zb3VyY2UpCjEgMCBvYmoKPDwKL0YxIDIgMCBSIC9GMiAzIDAgUiAvRjMgNCAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL0Jhc2VGb250IC9IZWx2ZXRpY2EgL0VuY29kaW5nIC9XaW5BbnNpRW5jb2RpbmcgL05hbWUgL0YxIC9TdWJ0eXBlIC9UeXBlMSAvVHlwZSAvRm9udAo+PgplbmRvYmoKMyAwIG9iago8PAovQmFzZUZvbnQgL0hlbHZldGljYS1Cb2xkIC9FbmNvZGluZyAvV2luQW5zaUVuY29kaW5nIC9OYW1lIC9GMiAvU3VidHlwZSAvVHlwZTEgL1R5cGUgL0ZvbnQKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL0Jhc2VGb250IC9aYXBmRGluZ2JhdHMgL05hbWUgL0YzIC9TdWJ0eXBlIC9UeXBlMSAvVHlwZSAvRm9udAo+PgplbmRvYmoKNSAwIG9iago8PAovQ29udGVudHMgMTAgMCBSIC9NZWRpYUJveCBbIDAgMCA1OTUuMjc1NiA4NDEuODg5OCBdIC9QYXJlbnQgOSAwIFIgL1Jlc291cmNlcyA8PAovRXh0R1N0YXRlIDw8Ci9nUkxzMCA8PAovY2EgLjEyCj4+IC9nUkxzMSA8PAovY2EgMQo+Pgo+PiAvRm9udCAxIDAgUiAvUHJvY1NldCBbIC9QREYgL1RleHQgL0ltYWdlQiAvSW1hZ2VDIC9JbWFnZUkgXQo+PiAvUm90YXRlIDAgL1RyYW5zIDw8Cgo+PiAKICAvVHlwZSAvUGFnZQo+PgplbmRvYmoKNiAwIG9iago8PAovQ29udGVudHMgMTEgMCBSIC9NZWRpYUJveCBbIDAgMCA1OTUuMjc1NiA4NDEuODg5OCBdIC9QYXJlbnQgOSAwIFIgL1Jlc291cmNlcyA8PAovRm9udCAxIDAgUiAvUHJvY1NldCBbIC9QREYgL1RleHQgL0ltYWdlQiAvSW1hZ2VDIC9JbWFnZUkgXQo+PiAvUm90YXRlIDAgL1RyYW5zIDw8Cgo+PiAKICAvVHlwZSAvUGFnZQo+PgplbmRvYmoKNyAwIG9iago8PAovUGFnZU1vZGUgL1VzZU5vbmUgL1BhZ2VzIDkgMCBSIC9UeXBlIC9DYXRhbG9nCj4+CmVuZG9iago4IDAgb2JqCjw8Ci9BdXRob3IgKFwoYW5vbnltb3VzXCkpIC9DcmVhdGlvbkRhdGUgKEQ6MjAyNjA4MjQxMjE4MzIrMDAnMDAnKSAvQ3JlYXRvciAoXCh1bnNwZWNpZmllZFwpKSAvS2V5d29yZHMgKCkgL01vZERhdGUgKEQ6MjAyNjA4MjQxMjE4MzIrMDAnMDAnKSAvUHJvZHVjZXIgKFJlcG9ydExhYiBQREYgTGlicmFyeSAtIFwob3BlbnNvdXJjZVwpKSAKICAvU3ViamVjdCAoXCh1bnNwZWNpZmllZFwpKSAvVGl0bGUgKEJ1ZW5hcyBwclwzNDFjdGljYXMgcGFyYSB0cmFiYWphciBjb24gYXNpc3RlbnRlcyBkZSBJQSkgL1RyYXBwZWQgL0ZhbHNlCj4+CmVuZG9iago5IDAgb2JqCjw8Ci9Db3VudCAyIC9LaWRzIFsgNSAwIFIgNiAwIFIgXSAvVHlwZSAvUGFnZXMKPj4KZW5kb2JqCjEwIDAgb2JqCjw8Ci9GaWx0ZXIgWyAvQVNDSUk4NURlY29kZSAvRmxhdGVEZWNvZGUgXSAvTGVuZ3RoIDI1NTEKPj4Kc3RyZWFtCkdiISNdYkF1QFcnJkRrKF0hQmFZZDBTVGlsc2M8RjhrT0JOXHAoIXEmL1w5PiFcaSs0XnRBWV9IWzVbUlRNL08yYC5jQCI4NzVhZUIyM1pDKlgxV2I/ZjZDIiVGTm9McVZnVWZKcmptPC4jPlIoRFFgNCVjLEpec1FjK19malEkSjFRSCVWT2UjWTAqJSprV2RiQigkPDdIMCMoUCM9bkFkYlhYNj81c1pZTytAbSwxQiwzRzVOUklWQzcxRlhFbEdPKGg/S2BYOGE8LUA9OUs/Iz81MDtXOGlJMmJybmNPJUJxUl0+PkFfUTFcZGQsSUlkMV03cyY1Zlw3SyI9PkgoXllxVD9jUV0/QlAtRHJganMvN1dHWTFYZTkmW2x1LV1iKU9IMlIlOVhIbThYLi1uTVhec201OlQhOS1PWi1KXmg0OHFFQTY+YGo6aXFJJmQzSkZEdCNHZyFHIVkzbVFAPCNfJlJwN25dXTIqVnVUSEM/dERHVm1PS2VgZGdnbUxSUShYRFVKZ040V0lPbCc1I0woWE5OZ3BTWklRP2hoKnNzW2x0amQ2K1MsNz08NzJkOkxIQyNVRjRlbyclQEtDNycqdDRKJXRqOGNRQW89dWBwbUElVD01Rm8sJHIiTkFJQ1RPTC80cjw8NjVaZiNqUkBOTT9kUmdlMUQhLUNhW3Q0PixwWWokWidxUkouTEEmKD9zVypZOzE8N0NjIkVBKjYwLnArNy9yL1JtclZMRkgsImJlX2h1NC4hO2whQUhQUi8jbSxUWF1nSkFsWkJbby9ZYiNlclo2YFk3NDROKm5SbjM5M0VTUEwsMl9iPVM2dUUrK2dWQTtDPW9yY3QlVTIkS0xnIV1vZ1RePiZqL10yckN0MTtwZzdEXFVqU29UP3BjRVNnQm8rWTU4bDJBUFVsZk1uIkAyODFAUWpZQThBIjtkImZAOVxQVjJNJmUoPmRYIyRdTS00SyFocltbNVZXcEdJbk1hbGgvZVpMQ2o2KihRNXNEIyhDcUVuMDNLKD1bKmVOUmlHak4rYG5JVExcSSQmNXMxaUJiMWU+bmoyOGNbSmZXQEAkOVJpQFM3SjdRNlMvPjsrUFdgKSxGXUxHRFlvWT5yX2hvSCZFOjArdGFFPGEiY2ZPWzshXDY7QjFURy40JksuKVMhKig5LVh0JmltOjItJCdYbCNMZGpSQTFFNTtibV5rVU9RKSxdcWhva0tGZ1g8OzovYEJfaUZIVlZbb2xuX2EwZCFLX101YEs1Q21bQV4yTy9rWSQ+dEdHQ28iLz4pJ1tCRixXIV5gNm1aV2JvTz4qZDUtPiUjME40WWA2TCcwYGEqIUBBY3JTa1s2JjhdUy02PyJrbjpxWXJqb2oibGEsXGZDMShcOWpbQnRBQnBvQyVBaVlOaWxYS2xKX0UrRGAhUlA7K01gQztKYVg0QFgxa2REbyk8PWI2U0s+SUxpZGxmZlxuczY7aFEncDo+aVRKI3RoPDwvOV5FPGEuNTgvKy0qUWRlTWRnK0xfY2VuVkhZUGhiQT1jXkpMSkctO1I0QT85WG87aHNnNlVPXTIiJFNqK3AwaktcQlphIS1CMlclS0tQLTRZPSNebWphY15DPyMkZFlnKUgxVmtSXCgqRkU9bSNIKUJDPGhGWVtuK1cpRi1XIyIsMCFuWCRANmlUW15WbERaPHRAKm1zNSQ4LnFcRVNeYFVpcjc+STYncSRzOyMvYy5YVTJuJGI5PjFtJmpMRFMlNydqcV4rMC09MTZYWExvaCZwNmo7QDtHPVUiTz1lK08oUzJwUy4hTEAhLVcoRiZiPm5qLkc2RXMxLy5ZPyRyJVFwSFpzSVRgSTw2cSRpSlBhdWRocChSZHJqSFciajFbJ04oM1k/VXFScFtnN202SiZfRmg2KjJkI1RWKmckKExPZTUzSkoqTHFGWEdzUUsrbCVOcDtgM0wvTUc3KSZtRWpnZEdqKWYpYmkmc29ASDpWQVJoKzIkJ1ZmPFZoZ1c0RTlBXnJrNlc5PFEtWkA+Xy43Ki5gZ3BkKS9jPjh1Klg8NnNWS2I7X1RILkU7UDlFUWQ0KSZEUGUnaWEua3I2KSlAIVcmYVlrO0EkYVNQWGJcL1MxLHQmRzcnSi8hIUZVb0pKQT8hNlJOXTwmXW9JI1VzbmwlTSJyJW1wS2NaVyRNLE03bkY6TitWU05KKEBjWjgtJC08UWlrXlRMJmBWLVlsaGhkNFovaSopJVd0LzJbaDZLWG0sKGJkb1VFVURyVFFIYT9AXWRoUmg9ZksiRlw0cTNgVVZYJm88KWBzWWwnJ1w7QVI5MmpUUCNeWT47QUxONHRpJExSSVtmYGM0cmA+O1s1MyFYNDEwPWJIMVJVOHEtLCosYTpyXG1pbU80Smk7NXFuLmNiIV1gUi03dDE2RUsmIy5TKEMlRzkqQWUlKC5zVGUsR1pXTXE3UUZWUS5gajskcGElTExpWW1faS9nXyU+TGlIVisqTzltLTI+YlIjU1xpdTRPJ2BeS0YrX2JvRjRtVCRSK1ddXFFSRiFzUVlENlcqKit1VycrNWozQzg+TkVjQlBgI1BSJ0AmSzhkZ3QhOl8zVlNjajRXL202Oz80RC1yQTNOPVRiWCtZREFxYTgsYUFyJC8waFp0SmFdYGM8OmRaJDloSTNoT0ZkQi5NSkxfTT5OJmdwTU4sLTJxRW5da0R0VzA1JV1JIj0vPWlQU24vaUk7ZytgTFNQJyY7XVhHQHMnayhYTzlYcVhdI19NNUh0ZHFAPEkhMEk5UDx0TihXV1QpIilKJmA3JTBDW04nTF4iN0E5VyhdL1FFcTlCTy5qUUFMVz9RMnRkU18uXSEzVCp0ajA/SUhLN2BuL2cpYC05NV51Qj8oOkIiKGdAXT0qM1MqZ3Q8OVpvQDA7dEBEZk5BbiJGaGsjRiIucktwNStFLTU2SldTaSNIWldoPVhnXU1iKlFfK2grMmFcTmoocDMrIUhrXzkqYClBZ0dsLkpTSCtgTidsZ2EnbjgjdDtjNCgjOGhJXz4xcGlHTFtOayhCaWxMS2RKLUlYLk5uXzpgOz9SMCVXOyhLK1M4M05jcjRLJSU3K0k3ZWZcPj4yVk0jZzZuRVhQRSlJWHE3J0VIRzY0dFAuUlFuKy1SazU3TmwnL1BTSmk3UHVYZilLM2VpSz9nXE86WVlDaiNcMCdDMEVSaG9bTVMkSjZOV2ppWEVldGtAWUgwcFkpdFpKZHJcUS5RV21BUUtXX0xLSGVBSVFXUzlqW0EtclJGTzM5RHI3LyoqbElZVV9KQUMlUS9FUmlDdWRsdShhckkwbz8vbEMiKj8iV3NCOWxuX0lYPkdiKy83Kjg/bWQmNmUtQkFfUF43SGlcN1w6KFkyPzJQZTA8LC5Cfj5lbmRzdHJlYW0KZW5kb2JqCjExIDAgb2JqCjw8Ci9GaWx0ZXIgWyAvQVNDSUk4NURlY29kZSAvRmxhdGVEZWNvZGUgXSAvTGVuZ3RoIDQ2MQo+PgpzdHJlYW0KR2FyJyQ7K290KCdTWUhBLydkMCdQImpATUQ6cDslPyEncCIuL1BoU0dBPi4+Y28uPyRfWVdUMyk9IkZ1VGEsbWltXmAnak9TbCcrXSxROWkoLWQ2dS4jaUJcQVY8P3JMTDRvZz1wU29GQ2hhNlAuVkdjZlZXVkZMRSpaWEVmQmg4MyQ9LWQ+TFpHX1QvOy1sW1A4bCxWV2lSMigvZEwiOjklW0QjWEJrYShYX1YmZT5iYDVBPyZSLGpqM1M6Z2diN0YxV1ZETEMzLT5JQltCIjhbb1JzdCZibVgxXEJUSGdbXlgmKE5CUE9OXWM/ZS0vN1FsTmhUYDlwNW8iZ3FZVnEycT0tXFguU0A4TkFJRWphQWFLPzVCQFs1SDNUUHJgRioxPXIlYGFxSV5DWU1AbmMxc1FcI0RQLDtLUFRoR00nPCZzMElnWUVJczM+TjlRSWE/VE1xTGkoL1BPK15pL11VJHAzN2VucDwyKkIzKVcpYCJDQEdRJzUuYSVscHEnOmFsQ15UcGNOTTo3bF46LkJGKnI7M1o8MG0tJyVJWGsyOyNdcF8vLEkzOTFObEpOKVpzRi5zWnFpdF1RXl45RG83OmpgN2FOMFdRfj5lbmRzdHJlYW0KZW5kb2JqCnhyZWYKMCAxMgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwNjEgMDAwMDAgbiAKMDAwMDAwMDExMiAwMDAwMCBuIAowMDAwMDAwMjE5IDAwMDAwIG4gCjAwMDAwMDAzMzEgMDAwMDAgbiAKMDAwMDAwMDQxNCAwMDAwMCBuIAowMDAwMDAwNjc1IDAwMDAwIG4gCjAwMDAwMDA4NzkgMDAwMDAgbiAKMDAwMDAwMDk0NyAwMDAwMCBuIAowMDAwMDAxMjY4IDAwMDAwIG4gCjAwMDAwMDEzMzMgMDAwMDAgbiAKMDAwMDAwMzk3NiAwMDAwMCBuIAp0cmFpbGVyCjw8Ci9JRCAKWzwyNWMzMjhjODYzYmVhMGQxNmMxYTcyODk5ZWRiMThkYj48MjVjMzI4Yzg2M2JlYTBkMTZjMWE3Mjg5OWVkYjE4ZGI+XQolIFJlcG9ydExhYiBnZW5lcmF0ZWQgUERGIGRvY3VtZW50IC0tIGRpZ2VzdCAob3BlbnNvdXJjZSkKCi9JbmZvIDggMCBSCi9Sb290IDcgMCBSCi9TaXplIDEyCj4+CnN0YXJ0eHJlZgo0NTI4CiUlRU9GCg==" }],
    quiz: [
      {
        question: "¿Qué suele mejorar la calidad de la respuesta de un asistente de IA?",
        options: ["Escribir la pregunta lo más corta y ambigua posible", "Dar contexto claro y detalle específico sobre lo que necesitas", "Nunca dar ejemplos", "Escribir todo el mensaje en mayúsculas"],
        correct: 1,
      },
      {
        question: "Si la primera respuesta no es exactamente lo que buscabas, ¿qué puedes hacer?",
        options: ["Darte por vencido inmediatamente", "Cerrar la sesión sin decir nada", "Pedirle que la ajuste o aclare, como en una conversación", "Culpar a la herramienta y no volver a usarla"],
        correct: 2,
      },
      {
        question: "¿Es recomendable revisar y editar un texto generado por IA antes de enviarlo a un cliente?",
        options: ["No, se puede enviar tal cual siempre", "Sí, siempre conviene revisarlo y adaptarlo con tu propio criterio", "Solo si es muy largo", "Solo si lo pide el cliente"],
        correct: 1,
      },
      {
        question: "¿Qué tipo de tareas NO deberías delegar por completo en un asistente de IA sin supervisión?",
        options: ["Traducir un párrafo sencillo", "Generar ideas para una lluvia de ideas", "Resumir un correo largo", "Decisiones con impacto legal, de seguridad o económico importante"],
        correct: 3,
      },
      {
        question: "¿Qué ventaja tiene mantener una conversación de varios mensajes con un asistente, en vez de un único mensaje suelto?",
        options: ["No tiene ninguna ventaja", "Permite ir refinando la respuesta con más contexto en cada paso", "Hace que la IA se equivoque más", "Solo sirve para hacer la conversación más larga"],
        correct: 1,
      },
    ],
  },
];

export const SEED_NEWS = [
  {
    id: uid(),
    date: todayISO(),
    title: "Bienvenida al Aula Virtual",
    body: "Este es el espacio de formación de Muñoz Bosch: protocolos, formación general y por equipo, e IA y nuevas tecnologías. Cada formación incluye vídeo, material y un test final.",
  },
  {
    id: uid(),
    date: todayISO(),
    title: "Nueva formación disponible: IA en el trabajo",
    body: "Ya está disponible la guía general de Inteligencia Artificial en el trabajo, en la categoría IA y nuevas tecnologías. Recomendada para todo el equipo.",
  },
];
