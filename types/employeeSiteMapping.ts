export type MappingStatus = "Active" | "Inactive";

export interface EmployeeSiteMapping {
  id?: string;
  mappingGroupId: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  siteId: string;
  siteCode: string;
  siteName: string;
  clientName: string;
  fromDate: string;
  toDate: string;
  status: MappingStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface GroupedEmployeeSiteMapping {
  mappingGroupId: string;
  siteId: string;
  siteCode: string;
  siteName: string;
  clientName: string;
  fromDate: string;
  toDate: string;
  status: MappingStatus;
  employeeCount: number;
  employees: EmployeeSiteMapping[];
}
