# YOL1 Financial Planning & Product Roadmap

MVP estructural de la aplicación interna de planificación financiera de YOL1.

> Toda cifra incluida en esta iteración está marcada como `SAMPLE / DEMO DATA`. Los Excel Enterprise, SMB y B2C todavía no se importan.

## Qué incluye

- Executive Dashboard consolidado para 36 meses.
- Navegación para Verticales, Productos, Roadmap, Costos, Supuestos, Escenarios e Importaciones.
- CRUD demo en memoria para verticales, productos y costos.
- Roadmap editable conectado al forecast demo.
- Forecast Engine TypeScript separado de React.
- Modelo inicial de escenarios con herencia conceptual.
- Migración PostgreSQL/Supabase normalizada.
- Seed demo reproducible.
- Contrato canónico para futuros adapters de Excel.
- Pruebas unitarias de los cálculos financieros principales.

## Ejecutar localmente

Requisitos:

- Node.js compatible con el proyecto.
- npm.

Desde este directorio:

```bash
npm install
npm run dev
```

Abrir `http://localhost:3000`.

La interfaz demo funciona sin credenciales. Los cambios creados desde los formularios son temporales y se reinician al refrescar; la persistencia en Supabase se conecta en el siguiente corte.

## Verificar

```bash
npm run test:unit
npm run build
```

Las pruebas cubren:

- ceros antes del Go Live;
- TPV × spread;
- revenue menos costos directos;
- costos mensuales desde la fecha de inicio;
- desplazamiento de una curva al mover el Go Live.

## Arquitectura

```text
UI / páginas
  ↓
casos de uso
  ↓
Forecast Engine puro
  ↓
repositorios
  ↓
Supabase / PostgreSQL
```

La lógica financiera está en `src/forecast-engine/index.ts`. No se calcula revenue dentro de componentes visuales.

El flujo mensual base es:

```text
Go Live
→ month_since_go_live
→ rampa / driver
→ pricing
→ revenue
→ costos directos
→ margen de contribución
→ costos generales
→ resultado operacional
→ cash acumulado
```

## Base de datos

La migración inicial está en:

```text
supabase/migrations/202608200001_initial_planning_schema.sql
```

El seed demo está en:

```text
supabase/seed.sql
```

Para levantar Supabase localmente se requiere la CLI de Supabase y un runtime compatible con Docker:

```bash
npx supabase start
npx supabase db reset
```

La base guarda inputs, reglas y versiones. `forecast_monthly` es una salida regenerable y no la fuente de verdad.

## Agregar una vertical

En la aplicación:

1. Abrir **Verticales**.
2. Seleccionar **+ Nueva vertical**.
3. Completar nombre y responsable.

En base de datos, la entidad corresponde a `verticals` y pertenece a una `organization`.

## Agregar un producto

1. Abrir **Productos**.
2. Seleccionar **+ Nuevo producto**.
3. Elegir vertical, Go Live y tipo de economics.

Un producto puede existir sin clientes. Su detalle por país se configura en `product_markets` y los clientes son opcionales mediante `product_clients`.

## Agregar un costo

1. Abrir **Costos**.
2. Seleccionar **+ Agregar costo**.
3. Definir valor, inicio, frecuencia y alcance.

La tabla `cost_items` admite alcance YOL1, vertical o producto y frecuencia mensual u one-off.

## Forecast Engine

Funciones principales:

- `buildForecastCalendar()`
- `calculateProductForecast()`
- `calculateCostForecast()`
- `calculateConsolidatedForecast()`
- `summarizeYears()`

Todas reciben inputs explícitos y devuelven resultados deterministas.

## Importación futura de Excel

El contrato está en:

```text
src/integrations/excel/adapter-contract.ts
```

El flujo será:

```text
Excel → Parser → Adapter de vertical → Validación → CanonicalForecastRow → Base YOL1
```

Se crearán posteriormente:

- `enterpriseExcelAdapter`
- `smbExcelAdapter`
- `b2cExcelAdapter`

La UI, el motor financiero y el dashboard no conocerán la estructura interna de cada Excel.

## Próximos pasos

1. Conectar los repositorios de la aplicación a Supabase.
2. Persistir CRUD y habilitar Supabase Auth.
3. Incorporar Draft/Approved y RLS por rol.
4. Reemplazar economics demo por los modelos reales.
5. Implementar los tres adapters de Excel.
