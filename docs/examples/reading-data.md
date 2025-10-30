# Reading Data from TM1

Examples of reading data from TM1 cubes using various methods.

## Table of Contents
- [Reading Single Cell Values](#reading-single-cell-values)
- [Executing MDX Queries](#executing-mdx-queries)
- [Reading from Views](#reading-from-views)
- [CSV Export](#csv-export)
- [DataFrame Operations](#dataframe-operations)

## Reading Single Cell Values

### Basic Cell Read

```typescript
import { TM1Service } from 'tm1npm';

const tm1 = new TM1Service(config);

try {
    await tm1.connect();

    // Read single cell value
    const value = await tm1.cubes.cells.getValue(
        'Budget',                          // Cube name
        ['Jan', 'Revenue', 'Actual']      // Element coordinates
    );

    console.log('Cell value:', value);

} finally {
    await tm1.logout();
}
```

### Multiple Cell Reads

```typescript
// Read multiple cells
const coordinates = [
    ['Jan', 'Revenue', 'Actual'],
    ['Feb', 'Revenue', 'Actual'],
    ['Mar', 'Revenue', 'Actual']
];

for (const coord of coordinates) {
    const value = await tm1.cubes.cells.getValue('Budget', coord);
    console.log(`${coord.join(':')} = ${value}`);
}
```

## Executing MDX Queries

### Simple MDX Query

```typescript
const mdx = `
    SELECT
        [Time].[Jan] ON COLUMNS,
        [Account].[Revenue] ON ROWS
    FROM [Budget]
`;

const cellset = await tm1.cubes.cells.executeMdx(mdx);
console.log('Query result:', cellset);
```

### MDX with WHERE Clause

```typescript
const mdx = `
    SELECT
        [Time].Members ON COLUMNS,
        [Account].Members ON ROWS
    FROM [Budget]
    WHERE ([Version].[Actual])
`;

const data = await tm1.cubes.cells.executeMdx(mdx);
```

### MDX with Options

```typescript
const mdx = "SELECT [Time].Members ON 0 FROM [Budget]";

const options = {
    sandbox_name: 'Development',
    skip_zeros: true,
    skip_consolidated: false,
    element_unique_names: true
};

const result = await tm1.cubes.cells.executeMdx(mdx, options);
```

## Reading from Views

### Execute View

```typescript
// Execute a named view
const data = await tm1.cubes.cells.executeView(
    'Budget',        // Cube name
    'YearlySummary', // View name
    true             // Private view
);

console.log('View data:', data);
```

### Execute View with Options

```typescript
const options = {
    private: true,
    sandbox_name: 'Development',
    skip_zeros: true
};

const result = await tm1.cubes.cells.executeView(
    'Budget',
    'YearlySummary',
    options
);
```

## CSV Export

### Export MDX to CSV

```typescript
const mdx = "SELECT [Time].Members ON 0, [Account].Members ON 1 FROM [Budget]";

const csvData = await tm1.cubes.cells.executeMdxCsv(mdx, {
    csv_dialect: {
        delimiter: ',',
        quotechar: '"',
        line_terminator: '\n'
    }
});

console.log('CSV Data:');
console.log(csvData);

// Save to file
import { writeFileSync } from 'fs';
writeFileSync('budget-data.csv', csvData);
```

### Export View to CSV

```typescript
const csvData = await tm1.cubes.cells.executeViewCsv(
    'Budget',
    'YearlySummary',
    true,  // private view
    {
        csv_dialect: {
            delimiter: ',',
            quotechar: '"'
        }
    }
);

writeFileSync('yearly-summary.csv', csvData);
```

## DataFrame Operations

### Execute MDX as DataFrame

```typescript
import { DataFrame } from 'tm1npm';

const mdx = `
    SELECT
        [Time].Members ON COLUMNS,
        [Account].Members ON ROWS
    FROM [Budget]
`;

const df = await tm1.cubes.cells.executeMdxDataFrame(mdx);

// Explore DataFrame
console.log('Shape:', df.shape);          // [rows, columns]
console.log('Columns:', df.columns);       // ['Time', 'Account', 'Value']
console.log('First 5 rows:', df.head(5));
```

### Filter and Sort

```typescript
const df = await tm1.cubes.cells.executeMdxDataFrame(mdx);

// Filter rows where Value > 1000
const filtered = df.filter((row) => row[2] > 1000);

// Sort by Value (descending)
const sorted = df.sortBy('Value', false);

console.log('Filtered & sorted data:', sorted.head(10));
```

### Group and Aggregate

```typescript
// Group by Account and sum values
const grouped = df.groupBy('Account').sum('Value');

console.log('Totals by account:', grouped);
```

## Complete Example: Budget Analysis

```typescript
import { TM1Service } from 'tm1npm';
import { writeFileSync } from 'fs';

async function analyzeBudget() {
    const tm1 = new TM1Service({
        address: 'localhost',
        port: 8001,
        user: 'admin',
        password: 'apple',
        ssl: true
    });

    try {
        await tm1.connect();

        // 1. Get actual vs budget data
        const mdx = `
            SELECT
                {[Version].[Actual], [Version].[Budget]} ON COLUMNS,
                [Account].Members ON ROWS
            FROM [Budget]
            WHERE ([Time].[Q1])
        `;

        // 2. Execute as DataFrame
        const df = await tm1.cubes.cells.executeMdxDataFrame(mdx);

        // 3. Calculate variance
        const withVariance = df.map((row) => {
            const actual = row[1];
            const budget = row[2];
            const variance = actual - budget;
            const variancePct = budget !== 0 ? (variance / budget) * 100 : 0;

            return [
                ...row,
                variance,
                variancePct.toFixed(2) + '%'
            ];
        });

        // 4. Export to CSV
        const csv = withVariance.toCsv(',');
        writeFileSync('budget-analysis.csv', csv);

        console.log('✅ Budget analysis complete!');
        console.log('   Results saved to budget-analysis.csv');

    } finally {
        await tm1.logout();
    }
}

analyzeBudget().catch(console.error);
```

## Best Practices

### 1. Use Appropriate Method for Data Size

```typescript
// Small data: Single cell reads
const value = await tm1.cubes.cells.getValue('Budget', ['Jan', 'Revenue']);

// Medium data: MDX queries
const data = await tm1.cubes.cells.executeMdx(mdx);

// Large data: CSV export or DataFrame
const csv = await tm1.cubes.cells.executeMdxCsv(mdx);
```

### 2. Leverage Skip Options

```typescript
// Skip unnecessary data
const options = {
    skip_zeros: true,           // Ignore zero values
    skip_consolidated: true,    // Ignore consolidated elements
    skip_rule_derived: false    // Include rule-calculated values
};

const data = await tm1.cubes.cells.executeMdx(mdx, options);
```

### 3. Use Sandboxes for Testing

```typescript
const options = {
    sandbox_name: 'Development'  // Read from sandbox
};

const data = await tm1.cubes.cells.executeMdx(mdx, options);
```

## Next Steps

- [Writing Data](writing-data.md) - Learn how to write data
- [DataFrame Operations](dataframe-operations.md) - Advanced data manipulation
- [Async Operations](async-operations.md) - Performance optimization
