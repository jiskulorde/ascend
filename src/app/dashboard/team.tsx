// src/app/dashboard/team.tsx
"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

type Agent = {
  id: number;
  name: string;
  role: string;
  status: "Active" | "Inactive";
  assignedDate: string;
};

export default function TeamSection() {
  const [agents, setAgents] = useState<Agent[]>([
    { id: 1, name: "Jane Doe", role: "Meta Ads Specialist", status: "Active", assignedDate: "2025-08-01" },
    { id: 2, name: "John Smith", role: "Content Strategist", status: "Inactive", assignedDate: "2025-07-15" },
  ]);

  return (
    <Card className="rounded-2xl shadow-md border border-gray-200 bg-white">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-blue-700">Team Management</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agent</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assigned Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agents.map((agent) => (
              <TableRow key={agent.id}>
                <TableCell className="flex items-center gap-2">
                  <Avatar>
                    <AvatarImage src={`https://i.pravatar.cc/150?u=${agent.id}`} />
                    <AvatarFallback>{agent.name[0]}</AvatarFallback>
                  </Avatar>
                  {agent.name}
                </TableCell>
                <TableCell>{agent.role}</TableCell>
                <TableCell>
                  <span
                    className={`px-2 py-1 rounded-full text-xs ${
                      agent.status === "Active" ? "bg-green-100 text-green-600" : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {agent.status}
                  </span>
                </TableCell>
                <TableCell>{agent.assignedDate}</TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm">Edit</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="mt-4 flex justify-end">
          <Dialog>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">Add Agent</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Agent</DialogTitle>
              </DialogHeader>
              <form className="space-y-3">
                <input type="text" placeholder="Name" className="w-full border p-2 rounded-md" />
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Meta Ads Specialist">Meta Ads Specialist</SelectItem>
                    <SelectItem value="Content Strategist">Content Strategist</SelectItem>
                    <SelectItem value="Designer">Designer</SelectItem>
                  </SelectContent>
                </Select>
                <Button className="w-full bg-blue-600 text-white">Save</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}
