import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CostTableManager } from '@/components/admin/CostTableManager'
import { ApprovedReportsList } from '@/components/admin/ApprovedReportsList'
import { ProhibitedPhrases } from '@/components/admin/ProhibitedPhrases'

export default function Library() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reference Library</h1>
        <p className="text-muted-foreground mt-1">
          Manage the reference data used for proofing reports
        </p>
      </div>

      <Tabs defaultValue="cost_table">
        <TabsList>
          <TabsTrigger value="cost_table">Cost Tables</TabsTrigger>
          <TabsTrigger value="approved_reports">Approved Reports</TabsTrigger>
          <TabsTrigger value="prohibited_phrases">Prohibited Phrases</TabsTrigger>
        </TabsList>

        <TabsContent value="cost_table">
          <Card>
            <CardHeader>
              <CardTitle>Cost Tables</CardTitle>
              <CardDescription>
                Line item pricing ranges. Reports are checked against these during proofing.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CostTableManager />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approved_reports">
          <Card>
            <CardHeader>
              <CardTitle>Approved Reports</CardTitle>
              <CardDescription>
                Sample approved reports by service type. Used to validate section structure.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ApprovedReportsList />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prohibited_phrases">
          <Card>
            <CardHeader>
              <CardTitle>Prohibited Phrases</CardTitle>
              <CardDescription>
                Language that should never appear in reports due to liability concerns.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProhibitedPhrases />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
