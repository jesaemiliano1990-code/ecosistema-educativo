// publico/js/modulos/privacidad.js
// Módulo para la visualización del aviso de privacidad y LOPDP del Ecuador

import { montarPlantilla } from '../nucleo/plantilla.js';

await montarPlantilla({ titulo: 'Aviso de Privacidad', roles: ['publico'] });

const contenido = document.getElementById('contenido');
if (contenido) {
  contenido.innerHTML = `
    <div class="privacidad-contenedor">
      <article class="privacidad-tarjeta" role="article" aria-labelledby="tituloPrivacidad">
        <header class="privacidad-header">
          <h1 id="tituloPrivacidad">Aviso de Privacidad y Tratamiento de Datos Personales</h1>
          <p>Conforme a la Ley Orgánica de Protección de Datos Personales (LOPDP) de la República del Ecuador.</p>
        </header>

        <section class="privacidad-seccion" aria-labelledby="secFinalidad">
          <h2 id="secFinalidad">1. Finalidad del tratamiento</h2>
          <p>
            El <strong>Ecosistema Educativo</strong> recopila y procesa sus datos personales exclusivamente con fines formativos, académicos y de gestión pedagógica: proveer acceso a contenidos temáticos, registrar el avance escolar, evaluar actividades interactivas, facilitar herramientas gamificadas de retroalimentación y asegurar la trazabilidad del aprendizaje.
          </p>
        </section>

        <section class="privacidad-seccion" aria-labelledby="secDatos">
          <h2 id="secDatos">2. Datos personales tratados</h2>
          <p>Para la prestación de los servicios educativos, se tratan las siguientes categorías de datos:</p>
          <ul class="privacidad-lista">
            <li><strong>Nombre y Apellido:</strong> Para la identificación individual del estudiante o docente en la plataforma y la emisión de reconocimientos académicos.</li>
            <li><strong>Correo electrónico:</strong> Como identificador de acceso único para la cuenta, autenticación segura y notificaciones académicas esenciales.</li>
            <li><strong>Actividad en la plataforma:</strong> Registro de temas visitados, intentos en actividades, puntajes, respuestas de autoevaluación y eventos de bitácora para garantizar la seguridad del sistema y el acompañamiento pedagógico.</li>
          </ul>
        </section>

        <section class="privacidad-seccion" aria-labelledby="secDerechos">
          <h2 id="secDerechos">3. Derechos de los titulares (LOPDP Ecuador)</h2>
          <p>
            De conformidad con los artículos correspondientes de la <em>Ley Orgánica de Protección de Datos Personales</em> del Ecuador, usted o su representante legal tienen los siguientes derechos:
          </p>
          <ul class="privacidad-lista">
            <li><strong>Derecho de Acceso:</strong> Conocer qué datos personales suyos están siendo tratados y las condiciones del tratamiento.</li>
            <li><strong>Derecho de Rectificación y Actualización:</strong> Modificar o actualizar cualquier dato que sea inexacto, incompleto o erróneo.</li>
            <li><strong>Derecho de Eliminación:</strong> Solicitar la supresión de sus datos personales cuando hayan dejado de ser necesarios o pertinentes para la finalidad educativa.</li>
            <li><strong>Derecho de Oposición:</strong> Oponerse al tratamiento en los términos previstos por la normativa vigente.</li>
          </ul>
        </section>

        <section class="privacidad-seccion" aria-labelledby="secContacto">
          <h2 id="secContacto">4. Canal de atención y contacto</h2>
          <p>
            Para el ejercicio de cualquiera de sus derechos o para formular consultas relativas a la protección de sus datos personales, puede comunicarse directamente con nuestro delegado de protección de datos:
          </p>
          <div class="privacidad-contacto">
            <p><strong>Correo de contacto:</strong> <a href="mailto:privacidad@ecosistemaeducativo.edu.ec">privacidad@ecosistemaeducativo.edu.ec</a></p>
          </div>
        </section>

        <footer class="privacidad-acciones">
          <a href="/paginas/registro.html" class="btn btn--primario">Volver al Registro</a>
          <a href="/index.html" class="btn btn--secundario">Ir al Inicio</a>
        </footer>
      </article>
    </div>
  `;
}
