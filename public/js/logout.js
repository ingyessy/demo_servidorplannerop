// Añadir al final del addEventListener de DOMContentLoaded

// Botón de logout
document.getElementById('logoutBtn').addEventListener('click', async () => {
  try {
    const token = localStorage.getItem('auth_token');
    
    if (token) {
      // 1. Llamar al endpoint de logout para invalidar el token en el servidor
      await fetch('/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      // 2. Limpiar localStorage
      localStorage.removeItem('auth_token');
      
      // 3. Limpiar cookies
      document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
      
      // 4. Mostrar el formulario de login nuevamente
      document.getElementById('loginForm').style.display = 'block';
      document.getElementById('successMsg').style.display = 'none';
      
      // 5. Mostrar el párrafo de instrucciones nuevamente
      const parrafoElement = document.querySelector('.parrafo');
      if (parrafoElement) {
        parrafoElement.style.display = 'block';
      }
      
      // 6. Limpiar campos de formulario
      document.getElementById('username').value = '';
      document.getElementById('password').value = '';
      document.getElementById('errorMsg').style.display = 'none';
    }
  } catch (error) {
    console.error('Error durante el cierre de sesión:', error);
    // Limpiar de todas formas por si acaso
    localStorage.removeItem('auth_token');
    document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    location.reload();
  }
});