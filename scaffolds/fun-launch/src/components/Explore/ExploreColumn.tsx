useEffect(() => {
  queryClient.setQueriesData(
    {
      type: 'active',
      queryKey: ApeQueries.gemsTokenList(request).queryKey,
    },
    (prev?: QueryData<typeof ApeQueries.gemsTokenList>) => {
      const prevPools = prev?.[tab]?.pools;

      // ✅ Fix: always return something, not undefined
      if (!prevPools) {
        return prev ?? {};
      }

      const pools = [...prevPools];

      // Re-sort
      const sortDir = categorySortDir(tab);
      let sortBy: TokenListSortByField | undefined;
      const defaultSortBy = categorySortBy(tab, timeframe);
      if (defaultSortBy) {
        sortBy = normalizeSortByField(defaultSortBy);
      }
      if (sortBy) {
        const sorter = createPoolSorter(
          {
            sortBy,
            sortDir,
          },
          timeframe
        );
        pools.sort(sorter);
      }

      return {
        ...prev,
        [tab]: {
          ...prev[tab],
          pools,
        },
        args: {
          ...prev?.args,
          timeframe,
        },
      };
    }
  );
}, [queryClient, tab, request]);
