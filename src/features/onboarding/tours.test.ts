import { describe, expect, it } from 'vitest'
import { TOUR_IDS } from '../../store/types'
import { TOURS } from './tours'

const COUNTS = { budget: 7, notes: 6, due: 5 } as const

describe('tours', () => {
  it('has one tour per tab id', () => {
    expect(Object.keys(TOURS).sort()).toEqual([...TOUR_IDS].sort())
    for (const id of TOUR_IDS) expect(TOURS[id].id).toBe(id)
  })

  for (const id of TOUR_IDS) {
    const tour = TOURS[id]
    it(`${id}: ${COUNTS[id]} steps with real words and unique ids`, () => {
      expect(tour.steps).toHaveLength(COUNTS[id])
      expect(tour.title.trim()).not.toBe('')
      expect(tour.place.trim()).not.toBe('')
      const ids = tour.steps.map((s) => s.id)
      expect(new Set(ids).size).toBe(ids.length)
      for (const s of tour.steps) {
        expect(s.id.trim()).not.toBe('')
        expect(s.heading.trim()).not.toBe('')
        expect(s.text.trim()).not.toBe('')
        if (s.try) {
          expect(s.try.label.trim()).not.toBe('')
          expect(s.try.action).toBeTruthy()
        }
      }
    })
  }
})
