# qlik-venn

A venn diagram extension for Qlik Sense. This extension leverages the power of Qlik Sense engine's to make all the set calculations. It is thus very fast, relyable and consistent with other Qlik Sense KPIs.

# How to use

The first dimension represents the circles. Each value of the first dimension will be a different circle (max = 8). It could for instance be the Products dimension.

The second dimension represents what is counted. It is for instance the Customers dimension.

Each circle represents the number of customers for each product.

The space where the areas merge represents the customers that bought the two products.

It is possible to select the customers that bought one product or the two products, but also (and more interestingly) that bought one product only, and not the other one.

# Warning

This uses the low level engine RPC Qlik Sense API. It might thus break in future versions

# Credits

Thanks to Brice Saccucci for his ideas

Thanks to Alexander Karlsson (https://github.com/mindspank/) & Ingemar Carlo for their help

Thanks to Xavier Le Pitre for the business case

# License

The MIT License (MIT)

Copyright (c) 2015 Loïc Formont

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.