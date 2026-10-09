// Modules generated at build time by the c4-content plugin in vite.config.ts.
// (Inline type expressions: ambient modules can't use relative import declarations.)
declare module 'virtual:c4-content/all' {
  const bundle: import('./schema.ts').ContentBundle
  export default bundle
}

declare module 'virtual:c4-content/standards' {
  const standards: import('./schema.ts').Standard[]
  export default standards
}

declare module 'virtual:c4-content/grade-*' {
  const content: import('./grade.ts').GradeContent
  export default content
}
