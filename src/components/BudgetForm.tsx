import { useEffect, useMemo, useState, type FormEvent, type ChangeEvent } from 'react'
import { addDoc, collection, doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import type { Budget } from '../models/types'
import type { BudgetWithUsage } from '../hooks/useBudgets'

type BudgetFormProps = {
  userId: string | null
  existingBudget?: BudgetWithUsage | null
  onComplete?: () => void
}

type BudgetFormState = {
  category: string
  limit: number | ''
  period: string
  startDate: string
  endDate: string
}

const PERIOD_OPTIONS = ['monthly', 'weekly', 'quarterly', 'yearly', 'custom']

const todayISO = () => new Date().toISOString().split('T')[0]

const defaultPeriodDates = (): { startDate: string; endDate: string } => {
  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth(), 1)
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  }
}

export function BudgetForm({ userId, existingBudget, onComplete }: BudgetFormProps) {
  const defaults = useMemo(defaultPeriodDates, [])
  const periodOptions = useMemo(() => {
    const base = new Set(PERIOD_OPTIONS)
    if (existingBudget?.period) {
      base.add(existingBudget.period)
    }
    return Array.from(base)
  }, [existingBudget?.period])
  const defaultPeriod = periodOptions[0] ?? PERIOD_OPTIONS[0]

  const [form, setForm] = useState<BudgetFormState>({
    category: '',
    limit: '',
    period: defaultPeriod,
    startDate: defaults.startDate,
    endDate: defaults.endDate,
  })

  const isEditing = Boolean(existingBudget)

  useEffect(() => {
    if (existingBudget) {
      setForm({
        category: existingBudget.category,
        limit: existingBudget.limit,
        period: existingBudget.period,
        startDate: existingBudget.startDate || defaults.startDate,
        endDate: existingBudget.endDate || defaults.endDate,
      })
    } else {
      setForm({
        category: '',
        limit: '',
        period: defaultPeriod,
        startDate: defaults.startDate,
        endDate: defaults.endDate,
      })
    }
  }, [existingBudget, defaults.startDate, defaults.endDate, defaultPeriod])

  const handleInputChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    formatter?: (value: string) => string,
  ) => {
    const { name, value } = event.target
    setForm(prev => ({
      ...prev,
      [name]: formatter ? formatter(value) : value,
    }))
  }

  const handleLimitChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target
    if (value === '') {
      setForm(prev => ({ ...prev, limit: '' }))
      return
    }
    const parsed = Number(value)
    if (!Number.isNaN(parsed) && parsed >= 0) {
      setForm(prev => ({ ...prev, limit: parsed }))
    }
  }

  const resetForm = () => {
    setForm({
      category: '',
      limit: '',
      period: defaultPeriod,
      startDate: defaults.startDate,
      endDate: defaults.endDate,
    })
    onComplete?.()
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!userId) {
      alert('Please sign in to manage budgets.')
      return
    }

    if (!form.category.trim()) {
      alert('Category is required.')
      return
    }

    const limitValue = typeof form.limit === 'number' ? form.limit : Number(form.limit)
    if (!Number.isFinite(limitValue) || limitValue <= 0) {
      alert('Limit must be a positive number.')
      return
    }

    const payload: Omit<Budget, 'id'> = {
      userId,
      category: form.category.trim(),
      limit: limitValue,
      period: form.period || 'custom',
      startDate: form.startDate || todayISO(),
      endDate: form.endDate || form.startDate || todayISO(),
      spent: existingBudget?.spent ?? 0,
    }

    try {
      if (isEditing && existingBudget) {
        await updateDoc(doc(db, 'budgets', existingBudget.id), payload)
        alert('Budget updated!')
      } else {
        await addDoc(collection(db, 'budgets'), payload)
        alert('Budget created!')
      }
      resetForm()
    } catch (error) {
      console.error('Failed to save budget', error)
      alert('Error saving budget')
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded border border-slate-800 bg-slate-900/50 p-4 shadow"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-100">
          {isEditing ? 'Edit Budget' : 'Add Budget'}
        </h3>
        {isEditing && (
          <button
            type="button"
            onClick={resetForm}
            className="text-sm text-slate-400 underline underline-offset-4"
          >
            Cancel
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm text-slate-300">
          <span>Category</span>
          <input
            name="category"
            value={form.category}
            onChange={handleInputChange}
            placeholder="e.g. Groceries"
            className="w-full rounded border border-slate-700 bg-slate-950 p-2 text-slate-100 placeholder:text-slate-500"
            required
          />
        </label>
        <label className="space-y-1 text-sm text-slate-300">
          <span>Limit</span>
          <input
            type="number"
            min="0"
            name="limit"
            value={form.limit}
            onChange={handleLimitChange}
            className="w-full rounded border border-slate-700 bg-slate-950 p-2 text-slate-100"
            required
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm text-slate-300">
          <span>Period</span>
          <select
            name="period"
            value={form.period}
            onChange={handleInputChange}
            className="w-full rounded border border-slate-700 bg-slate-950 p-2 text-slate-100"
          >
            {periodOptions.map(option => (
              <option key={option} value={option}>
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm text-slate-300">
          <span>Start Date</span>
          <input
            type="date"
            name="startDate"
            value={form.startDate}
            onChange={handleInputChange}
            className="w-full rounded border border-slate-700 bg-slate-950 p-2 text-slate-100"
            required
          />
        </label>
      </div>

      <label className="space-y-1 text-sm text-slate-300">
        <span>End Date</span>
        <input
          type="date"
          name="endDate"
          value={form.endDate}
          onChange={handleInputChange}
          className="w-full rounded border border-slate-700 bg-slate-950 p-2 text-slate-100"
          required
        />
      </label>

      <button
        type="submit"
        className="w-full rounded bg-emerald-500 px-4 py-2 font-semibold text-white transition hover:bg-emerald-400"
      >
        {isEditing ? 'Update Budget' : 'Add Budget'}
      </button>
    </form>
  )
}

export default BudgetForm
