# Directrices de Trabajo y Autonomía del Proyecto

## 1. Modo de Autonomía Total (Por Defecto)
- **Ejecutar sin pedir confirmación**: No solicites aprobación ni permiso previo para realizar cambios en el código, instalar dependencias, reiniciar servidores o ejecutar pruebas.
- **Acción directa**: Identifica el problema, diseña la mejor solución según las mejores prácticas, aplícala directamente en los archivos, verifica la compilación (`npm run build`) y el funcionamiento, y entrega el resultado terminado.
- **Excepción única**: Solo detente a consultar antes de actuar si el usuario indica explícitamente en su mensaje frases como *"dime antes qué harías"* o *"no toques nada aún"*.

## 2. Rigor Financiero y Realismo de Mercado
- Mantener las restricciones de ciclo de vida empresarial:
  - Empresas maduras/defensivas (Consumer Staples, Healthcare, Utilities, Beta < 0.80) tienen el crecimiento perpetuo acotado al techo macro del PIB nominal (máx. 3.5%).
  - Respetar siempre el diferencial mínimo de rentabilidad $(r - g) \ge 2.25\%$ en Gordon-Shapiro para evitar divisiones asintóticas irreales.
- El Margen de Seguridad fija un **Techo Máximo Admisible de Compra** ($P_0 \le VP_{\text{MoS}}$), no un precio objetivo que deba esperarse a que suba.

## 3. Calidad de Código y Verificación
- Cada cambio en TypeScript/React debe compilar limpiamente (`npm run build`).
- Reiniciar el backend (`server/api.mjs`) cuando se modifique la lógica del motor o endpoints.
