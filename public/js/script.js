document.addEventListener('DOMContentLoaded', function () {
    const token = localStorage.getItem('auth_token');

    // Si ya hay token, verificar si es válido
    if (token) {
      fetch('/api', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }).then((response) => {
        if (response.ok) {
          // Token válido, mostrar opciones
          document.getElementById('loginForm').style.display = 'none';
          document.getElementById('successMsg').style.display = 'block';

          const parrafoElement = document.querySelector('.parrafo');
          if (parrafoElement) {
            parrafoElement.style.display = 'none';
          }
        } else {
          // Token inválido, limpiar
          localStorage.removeItem('auth_token');
        }
      });
    }

    // Botón de login
    document
      .getElementById('loginBtn')
      .addEventListener('click', async () => {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        if (!username || !password) {
          document.getElementById('errorMsg').textContent =
            'Por favor ingresa usuario y contraseña';
          document.getElementById('errorMsg').style.display = 'block';
          return;
        }

        try {
          const response = await fetch('/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
          });

          const data = await response.json();
          console.log(data);

          if (response.ok && data.access_token) {
            // Guardar token
            localStorage.setItem('auth_token', data.access_token);

            document.cookie = `auth_token=${data.access_token}; path=/; max-age=86400`;

            // Mostrar mensaje de éxito
            document.getElementById('loginForm').style.display = 'none';
            document.getElementById('successMsg').style.display = 'block';
            document.getElementById('errorMsg').style.display = 'none';
            window.location.reload();
          } else {
            document.getElementById('errorMsg').textContent =
              'Credenciales incorrectas';
            document.getElementById('errorMsg').style.display = 'block';
          }
        } catch (error) {
          document.getElementById('errorMsg').textContent =
            'Error al conectar con el servidor';
          document.getElementById('errorMsg').style.display = 'block';
        }
      });

    // Enter para enviar
    document
      .getElementById('password')
      .addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          document.getElementById('loginBtn').click();
        }
      });

    // Botones de navegación
    document.getElementById('apiBtn').addEventListener('click', () => {
      const token = localStorage.getItem('auth_token');

      // Crear un formulario temporal para enviar el token como header
      const form = document.createElement('form');
      form.method = 'GET';
      form.action = '/api';
      form.style.display = 'none';

      // Asegurarse de que el token esté disponible como cookie
      document.cookie = `auth_token=${token}; path=/; max-age=86400`;

      document.body.appendChild(form);
      form.submit();
    });

    document.getElementById('docsBtn').addEventListener('click', () => {
      const token = localStorage.getItem('auth_token');

      // Crear un formulario temporal para enviar el token como header
      const form = document.createElement('form');
      form.method = 'GET';
      form.action = '/docs';
      form.style.display = 'none';

      // Asegurarse de que el token esté disponible como cookie
      document.cookie = `auth_token=${token}; path=/; max-age=86400`;

      document.body.appendChild(form);
      form.submit();
    });
  });