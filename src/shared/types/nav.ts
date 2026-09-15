export interface NavItemType {
  label: string
  path?: string
  route:string
  submenu?: NavItemType[]
}