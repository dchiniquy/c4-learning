import type { Grade, Subject } from './schema.ts'

export const GRADE_LABEL: Record<Grade, string> = {
  prek: 'Pre-K',
  k: 'Kindergarten',
  '1': 'Grade 1',
  '2': 'Grade 2',
  '3': 'Grade 3',
}

export const SUBJECT_LABEL: Record<Subject, string> = {
  literacy: 'Literacy',
  math: 'Math',
  science: 'Science',
  'social-studies': 'Social studies',
  sel: 'Social-emotional',
  arts: 'Arts',
  movement: 'Movement',
  'life-skills': 'Life skills',
}
