import { ok } from '../../_local'

import type { AnalysisTotalTypes, MonthlySales, UserAccessSource, WeeklyUserActivity } from './types'

export const getCountApi = (): Promise<IResponse<AnalysisTotalTypes>> => {
  return ok({
    users: 102400,
    messages: 81212,
    moneys: 9280,
    shoppings: 13600
  })
}

export const getUserAccessSourceApi = (): Promise<IResponse<UserAccessSource[]>> => {
  return ok([
    { name: 'analysis.directAccess', value: 335 },
    { name: 'analysis.mailMarketing', value: 310 },
    { name: 'analysis.allianceAdvertising', value: 234 },
    { name: 'analysis.videoAdvertising', value: 135 },
    { name: 'analysis.searchEngines', value: 1548 }
  ])
}

export const getWeeklyUserActivityApi = (): Promise<IResponse<WeeklyUserActivity[]>> => {
  return ok([
    { name: 'analysis.monday', value: 132 },
    { name: 'analysis.tuesday', value: 201 },
    { name: 'analysis.wednesday', value: 154 },
    { name: 'analysis.thursday', value: 190 },
    { name: 'analysis.friday', value: 230 },
    { name: 'analysis.saturday', value: 220 },
    { name: 'analysis.sunday', value: 178 }
  ])
}

export const getMonthlySalesApi = (): Promise<IResponse<MonthlySales[]>> => {
  return ok([
    { name: 'analysis.january', estimate: 100, actual: 120 },
    { name: 'analysis.february', estimate: 120, actual: 82 },
    { name: 'analysis.march', estimate: 161, actual: 91 },
    { name: 'analysis.april', estimate: 134, actual: 154 },
    { name: 'analysis.may', estimate: 105, actual: 162 },
    { name: 'analysis.june', estimate: 160, actual: 140 },
    { name: 'analysis.july', estimate: 165, actual: 145 },
    { name: 'analysis.august', estimate: 114, actual: 150 },
    { name: 'analysis.september', estimate: 160, actual: 120 },
    { name: 'analysis.october', estimate: 160, actual: 130 },
    { name: 'analysis.november', estimate: 125, actual: 140 },
    { name: 'analysis.december', estimate: 150, actual: 160 }
  ])
}
