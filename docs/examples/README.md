# Examples

Practical examples for common tm1npm use cases.

## Data Operations
- **[Reading Data](reading-data.md)** - Read from cubes using MDX, views, and coordinates
- **[Writing Data](writing-data.md)** - Write to cubes with various methods
- **[DataFrame Operations](dataframe-operations.md)** - Pandas-like data manipulation
- **[CSV Export/Import](csv-operations.md)** - Work with CSV format

## Metadata Management
- **[Dimensions](dimensions.md)** - Create and manage dimensions
- **[Cubes](cubes.md)** - Cube operations and management
- **[Processes](processes.md)** - Execute and monitor TI processes
- **[Views](views.md)** - Create and manage cube views

## Advanced Topics
- **[Async Operations](async-operations.md)** - High-performance async patterns
- **[Security](security.md)** - User and group management
- **[Monitoring](monitoring.md)** - Logs, sessions, and performance
- **[Error Handling](error-handling.md)** - Robust error management

## Quick Reference

### Connect and Read Data
```typescript
import { TM1Service } from 'tm1npm';

const tm1 = new TM1Service({/* config */});

try {
    await tm1.connect();

    const value = await tm1.cubes.cells.getValue(
        'Budget',
        ['Jan', 'Revenue', 'Actual']
    );
    console.log('Value:', value);
} finally {
    await tm1.logout();
}
```

### Execute MDX Query
```typescript
const mdx = `
    SELECT
        [Time].[Jan] ON COLUMNS,
        [Account].[Revenue] ON ROWS
    FROM [Budget]
`;

const data = await tm1.cubes.cells.executeMdx(mdx);
```

### Write Multiple Cells
```typescript
const cellset = {
    'Jan:Revenue:Budget': 1000,
    'Feb:Revenue:Budget': 1100,
    'Mar:Revenue:Budget': 1200
};

await tm1.cubes.cells.write('Budget', cellset);
```

### Execute Process
```typescript
const result = await tm1.processes.execute('ImportData', {
    pFilename: 'data.csv',
    pYear: '2024'
});
```

### Create Dimension
```typescript
import { Dimension, Hierarchy, Element } from 'tm1npm';

const elements = [
    new Element('Total', 'Consolidated'),
    new Element('Q1', 'Consolidated'),
    new Element('Jan', 'Numeric'),
    new Element('Feb', 'Numeric'),
    new Element('Mar', 'Numeric')
];

const hierarchy = new Hierarchy('Time', 'Time', elements);
const dimension = new Dimension('Time', [hierarchy]);

await tm1.dimensions.create(dimension);
```

## See individual guides for detailed examples and explanations.
