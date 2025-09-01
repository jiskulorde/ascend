"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Home,
  Users,
  BarChart2,
  Settings,
  CalendarDays,
  Activity,
} from "lucide-react";
import Link from "next/link";

export default function Dashboard() {
  // Sales Data
  const { data: sales } = useQuery({
    queryKey: ["sales"],
    queryFn: async () => {
      const res = await fetch("/api/sales");
      return res.json();
    },
  });

  // Meta Ads Assignments
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-blue-50 to-white">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-lg border-r border-blue-100 flex flex-col">
        <div className="px-6 py-6 border-b border-blue-100">
          <h2 className="text-2xl font-bold text-blue-700">Ascend</h2>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-blue-50 text-blue-700 font-medium"
          >
            <Home className="w-5 h-5" /> Dashboard
          </Link>
          <Link
            href="/team"
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-blue-50 text-gray-700"
          >
            <Users className="w-5 h-5" /> Manage Team
          </Link>
          <Link
            href="/reports"
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-blue-50 text-gray-700"
          >
            <BarChart2 className="w-5 h-5" /> Reports
          </Link>
          <Link
            href="/assignments"
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-blue-50 text-gray-700"
          >
            <CalendarDays className="w-5 h-5" /> Assignments
          </Link>
          <Link
            href="/settings"
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-blue-50 text-gray-700"
          >
            <Settings className="w-5 h-5" /> Settings
          </Link>
        </nav>
        <div className="px-6 py-4 border-t border-blue-100">
          <p className="text-xs text-gray-500">© 2025 Ascend by DMCI Homes</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        <h1 className="text-3xl font-bold text-blue-800 mb-8">Dashboard</h1>

        {/* Stats */}
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { title: "Total Sales", value: "₱120,450", trend: "+12%" },
            { title: "Active Leads", value: "326", trend: "+5%" },
            { title: "Closed Deals", value: "48", trend: "+8%" },
          ].map((stat, i) => (
            <Card
              key={i}
              className="rounded-2xl border border-blue-100 shadow-sm hover:shadow-md transition-all bg-white"
            >
              <CardHeader>
                <CardTitle className="text-blue-700">{stat.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{stat.value}</p>
                <p className="text-sm text-green-600">{stat.trend} this month</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Sales Chart */}
        <Card className="mt-8 rounded-2xl border border-blue-100 bg-white shadow-sm hover:shadow-md">
          <CardHeader>
            <CardTitle className="text-blue-700">Sales Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={sales || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#1d4ed8"
                  strokeWidth={3}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Assignments */}
        <Card className="mt-8 rounded-2xl border border-blue-100 bg-white shadow-sm hover:shadow-md">
          <CardHeader>
            <CardTitle className="text-blue-700">Meta Ads Assignments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600 text-sm">
              Assign an agent to a campaign date:
            </p>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="rounded-md border shadow-sm"
            />
            {selectedDate && (
              <p className="text-sm text-blue-600">
                Selected Date:{" "}
                <span className="font-semibold">
                  {format(selectedDate, "PPP")}
                </span>
              </p>
            )}
            <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow">
              Assign Agent
            </Button>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="mt-8 rounded-2xl border border-blue-100 bg-white shadow-sm hover:shadow-md">
          <CardHeader>
            <CardTitle className="text-blue-700">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              "New lead assigned to Agent Juan",
              "Sales report generated",
              "Meta Ads campaign scheduled",
            ].map((activity, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 border border-blue-100 text-blue-800 text-sm shadow-sm"
              >
                <Activity className="w-4 h-4 text-blue-600" />
                {activity}
              </div>
            ))}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
