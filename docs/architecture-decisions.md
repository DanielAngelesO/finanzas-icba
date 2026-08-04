# Decisiones arquitectónicas

1. La aplicación es una SPA Vite sin backend. Google Identity Services entrega un token de corta vida guardado solo en memoria, y el navegador llama a Google Sheets API por REST.
2. El `TransactionRepository` es el único puerto usado por los casos de uso. El adaptador Google y el repositorio en memoria son intercambiables.
3. Las filas inválidas no bloquean la consulta: se excluyen, se cuentan y se muestran como incidencias. Todos los registros con ID duplicado quedan excluidos.
4. El dominio almacena importes positivos; el tipo determina el signo financiero. El balance es ingresos menos egresos.
5. La hoja única contiene todos los años y el período `YYYYMM` permite segmentar. Los datos opcionales vacíos se normalizan a `null`.
6. La allowlist visible en frontend no es un límite de seguridad. Google Sheet ACL y OAuth controlan el acceso real.
