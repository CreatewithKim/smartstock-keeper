import { useEffect, useState } from "react";
import {
  Receipt,
  Plus,
  Pencil,
  Trash2,
  CalendarIcon,
  TrendingDown,
} from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { expenseDB, Expense } from "@/services/db";
import { ensureDate, getDayRange, isDateInRange } from "@/services/dateUtils";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const EXPENSE_CATEGORIES = [
  "Rent",
  "Utilities",
  "Transport",
  "Salaries",
  "Supplies",
  "Maintenance",
  "Marketing",
  "Licenses & Permits",
  "Insurance",
  "Miscellaneous",
];

export default function Expenses() {
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);

  const [formData, setFormData] = useState({
    description: "",
    category: "",
    amount: "",
    date: format(new Date(), "yyyy-MM-dd"),
    notes: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const data = await expenseDB.getAll();
      setExpenses(data.sort((a, b) => ensureDate(b.date).getTime() - ensureDate(a.date).getTime()));
    } catch (error) {
      console.error("Error loading expenses:", error);
      toast({
        title: "Error",
        description: "Failed to load expenses",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      description: "",
      category: "",
      amount: "",
      date: format(selectedDate, "yyyy-MM-dd"),
      notes: "",
    });
    setEditingExpense(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingExpense) {
        await expenseDB.update({
          ...editingExpense,
          description: formData.description,
          category: formData.category,
          amount,
          date: new Date(formData.date),
          notes: formData.notes,
        });
        toast({ title: "Success", description: "Expense updated successfully" });
      } else {
        await expenseDB.add({
          description: formData.description,
          category: formData.category,
          amount,
          date: new Date(formData.date),
          notes: formData.notes,
          createdAt: new Date(),
        });
        toast({ title: "Success", description: "Expense recorded successfully" });
      }

      setIsDialogOpen(false);
      resetForm();
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save expense",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setFormData({
      description: expense.description,
      category: expense.category,
      amount: expense.amount.toString(),
      date: format(new Date(expense.date), "yyyy-MM-dd"),
      notes: expense.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await expenseDB.delete(id);
      toast({ title: "Success", description: "Expense deleted" });
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete expense",
        variant: "destructive",
      });
    }
  };

  const { start: startOfSelected, end: endOfSelected } = getDayRange(selectedDate);

  const filteredExpenses = expenses.filter(
    (e) => isDateInRange(e.date, startOfSelected, endOfSelected)
  );

  const dayTotal = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  // Monthly total (same month as selected date)
  const monthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  const monthEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1);
  const monthlyExpenses = expenses.filter(
    (e) => isDateInRange(e.date, monthStart, monthEnd)
  );
  const monthTotal = monthlyExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  // Category breakdown for the month
  const categoryTotals = monthlyExpenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {} as Record<string, number>);
  const sortedCategories = Object.entries(categoryTotals).sort(([, a], [, b]) => b - a);

  const isToday =
    format(selectedDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
  const dateLabel = isToday ? "Today's" : format(selectedDate, "MMM dd, yyyy");

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Loading expenses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">Expenses</h1>
          <p className="text-muted-foreground">Track all your business expenses</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn("gap-2", !isToday && "border-primary text-primary")}
              >
                <CalendarIcon className="h-4 w-4" />
                {isToday ? "Today" : format(selectedDate, "MMM dd, yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => {
                  if (date) {
                    setSelectedDate(date);
                    setCalendarOpen(false);
                  }
                }}
                disabled={(date) => date > new Date()}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          <Button
            onClick={() => {
              resetForm();
              setFormData((f) => ({
                ...f,
                date: format(selectedDate, "yyyy-MM-dd"),
              }));
              setIsDialogOpen(true);
            }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Expense
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <GlassCard className="border-destructive/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">{dateLabel} Expenses</p>
              <p className="text-3xl font-bold text-destructive">
                KSh {dayTotal.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {filteredExpenses.length} expense{filteredExpenses.length !== 1 ? "s" : ""}
              </p>
            </div>
            <Receipt className="h-12 w-12 text-destructive/30" />
          </div>
        </GlassCard>

        <GlassCard className="border-orange-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">
                {format(selectedDate, "MMMM yyyy")} Total
              </p>
              <p className="text-3xl font-bold text-orange-500">
                KSh {monthTotal.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {monthlyExpenses.length} expense{monthlyExpenses.length !== 1 ? "s" : ""}
              </p>
            </div>
            <TrendingDown className="h-12 w-12 text-orange-500/30" />
          </div>
        </GlassCard>

        <GlassCard className="border-muted-foreground/20">
          <div>
            <p className="text-sm text-muted-foreground mb-3">
              Top Categories ({format(selectedDate, "MMM yyyy")})
            </p>
            {sortedCategories.length > 0 ? (
              <div className="space-y-2">
                {sortedCategories.slice(0, 4).map(([cat, total]) => (
                  <div key={cat} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{cat}</span>
                    <span className="font-semibold text-foreground">
                      KSh {total.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No expenses this month</p>
            )}
          </div>
        </GlassCard>
      </div>

      {/* Expense List */}
      <GlassCard>
        <h2 className="text-xl font-semibold text-foreground mb-4">
          {dateLabel} Expenses
        </h2>
        {filteredExpenses.length > 0 ? (
          <div className="space-y-3">
            {filteredExpenses.map((expense) => (
              <div
                key={expense.id}
                className="flex items-center justify-between rounded-lg bg-destructive/5 p-4"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-foreground">
                      {expense.description}
                    </p>
                    <Badge variant="outline" className="text-xs">
                      {expense.category}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(expense.date), "MMM dd, yyyy")}
                  </p>
                  {expense.notes && (
                    <p className="text-sm text-muted-foreground mt-1 italic">
                      {expense.notes}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-lg font-bold text-destructive">
                    KSh {expense.amount.toLocaleString()}
                  </p>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                      onClick={() => handleEdit(expense)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(expense.id!)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Receipt className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              No expenses recorded
            </h3>
            <p className="text-muted-foreground mb-4">
              Start tracking your business expenses
            </p>
            <Button
              onClick={() => {
                resetForm();
                setFormData((f) => ({
                  ...f,
                  date: format(selectedDate, "yyyy-MM-dd"),
                }));
                setIsDialogOpen(true);
              }}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Expense
            </Button>
          </div>
        )}
      </GlassCard>

      {/* Add/Edit Dialog */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="glass-strong max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingExpense ? "Edit Expense" : "Record Expense"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="e.g. Electricity bill"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                required
              />
            </div>

            <div>
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(val) =>
                  setFormData({ ...formData, category: val })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="amount">Amount (KSh)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Enter amount"
                value={formData.amount}
                onChange={(e) =>
                  setFormData({ ...formData, amount: e.target.value })
                }
                required
              />
            </div>

            <div>
              <Label htmlFor="expenseDate">Date</Label>
              <Input
                id="expenseDate"
                type="date"
                value={formData.date}
                onChange={(e) =>
                  setFormData({ ...formData, date: e.target.value })
                }
                required
              />
            </div>

            <div>
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any details..."
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                rows={3}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  !formData.description || !formData.category || !formData.amount
                }
              >
                {editingExpense ? "Update" : "Record Expense"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
